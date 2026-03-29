from __future__ import annotations

import argparse
import json
import random
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from torch import nn
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset

from src.app.model import DKTConfig, DKTGRU


DIFF_TO_ID = {"easy": 1, "medium": 2, "hard": 3}


def normalize(text: str) -> str:
    return (text or "").strip().lower()


def gap_bucket(days: float) -> int:
    if days <= 0.25:
        return 1
    if days <= 1:
        return 2
    if days <= 3:
        return 3
    if days <= 7:
        return 4
    if days <= 14:
        return 5
    if days <= 30:
        return 6
    return 7


@dataclass
class EncodedEvent:
    topic_id: int
    module_id: int
    difficulty_id: int
    correctness_id: int
    gap_bucket_id: int
    recency_days: float


class SequenceDataset(Dataset):
    def __init__(self, sequences: List[dict], topic_to_id: Dict[str, int], module_to_id: Dict[str, int]):
        self.items = []
        for seq in sequences:
            events = seq.get("events", [])
            if len(events) < 2:
                continue

            encoded: List[EncodedEvent] = []
            for event in events:
                topic_name = normalize(event.get("topic", ""))
                module_name = normalize(event.get("module", ""))
                topic_id = topic_to_id.get(topic_name, 0)
                module_id = module_to_id.get(module_name, 0)
                difficulty_id = DIFF_TO_ID.get(normalize(event.get("difficulty", "medium")), 2)
                correctness_id = 2 if int(event.get("is_correct", 0)) == 1 else 1
                gap = float(event.get("time_gap_days", 0.0))
                recency = min(max(gap, 0.0), 365.0) / 365.0

                encoded.append(
                    EncodedEvent(
                        topic_id=topic_id,
                        module_id=module_id,
                        difficulty_id=difficulty_id,
                        correctness_id=correctness_id,
                        gap_bucket_id=gap_bucket(gap),
                        recency_days=recency,
                    )
                )

            if len(encoded) < 2:
                continue
            self.items.append(encoded)

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, idx: int) -> List[EncodedEvent]:
        return self.items[idx]


def collate_batch(batch: List[List[EncodedEvent]]) -> dict:
    max_len = max(len(seq) for seq in batch)

    def pad_int(values: List[int], pad: int = 0) -> List[int]:
        return values + [pad] * (max_len - len(values))

    def pad_float(values: List[float], pad: float = 0.0) -> List[float]:
        return values + [pad] * (max_len - len(values))

    topic_ids = []
    module_ids = []
    difficulty_ids = []
    correctness_ids = []
    gap_bucket_ids = []
    recency_days = []
    target_topic_ids = []
    target_correct = []
    mask = []

    for seq in batch:
        topic = [e.topic_id for e in seq]
        module = [e.module_id for e in seq]
        diff = [e.difficulty_id for e in seq]
        corr = [e.correctness_id for e in seq]
        gap = [e.gap_bucket_id for e in seq]
        rec = [e.recency_days for e in seq]

        # DKT target at time t predicts correctness of event t+1 for topic t+1.
        t_topic = [seq[i + 1].topic_id for i in range(len(seq) - 1)] + [0]
        t_corr = [1 if seq[i + 1].correctness_id == 2 else 0 for i in range(len(seq) - 1)] + [0]
        valid = [1] * (len(seq) - 1) + [0]

        topic_ids.append(pad_int(topic))
        module_ids.append(pad_int(module))
        difficulty_ids.append(pad_int(diff))
        correctness_ids.append(pad_int(corr))
        gap_bucket_ids.append(pad_int(gap))
        recency_days.append(pad_float(rec))

        target_topic_ids.append(pad_int(t_topic))
        target_correct.append(pad_float(t_corr))
        mask.append(pad_float(valid))

    return {
        "topic_ids": torch.tensor(topic_ids, dtype=torch.long),
        "module_ids": torch.tensor(module_ids, dtype=torch.long),
        "difficulty_ids": torch.tensor(difficulty_ids, dtype=torch.long),
        "correctness_ids": torch.tensor(correctness_ids, dtype=torch.long),
        "gap_bucket_ids": torch.tensor(gap_bucket_ids, dtype=torch.long),
        "recency_days": torch.tensor(recency_days, dtype=torch.float32),
        "target_topic_ids": torch.tensor(target_topic_ids, dtype=torch.long),
        "target_correct": torch.tensor(target_correct, dtype=torch.float32),
        "mask": torch.tensor(mask, dtype=torch.float32),
    }


def load_sequences(path: Path) -> List[dict]:
    rows = []
    with path.open("r", encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def build_vocabs(sequences: List[dict]) -> Tuple[Dict[str, int], Dict[str, int]]:
    topics = set()
    modules = set()
    for seq in sequences:
        for event in seq.get("events", []):
            topics.add(normalize(event.get("topic", "")))
            modules.add(normalize(event.get("module", "")))

    topic_to_id = {name: idx + 1 for idx, name in enumerate(sorted(item for item in topics if item))}
    module_to_id = {name: idx + 1 for idx, name in enumerate(sorted(item for item in modules if item))}
    return topic_to_id, module_to_id


def evaluate(model: nn.Module, loader: DataLoader, device: str) -> dict:
    model.eval()
    all_labels = []
    all_probs = []

    with torch.no_grad():
        for batch in loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            logits = model(
                batch["topic_ids"],
                batch["module_ids"],
                batch["difficulty_ids"],
                batch["correctness_ids"],
                batch["gap_bucket_ids"],
                batch["recency_days"],
            )

            gather_idx = (batch["target_topic_ids"] - 1).clamp(min=0).unsqueeze(-1)
            selected_logits = torch.gather(logits, dim=2, index=gather_idx).squeeze(-1)

            valid = batch["mask"] > 0
            if valid.sum().item() == 0:
                continue

            probs = torch.sigmoid(selected_logits[valid]).detach().cpu().numpy()
            labels = batch["target_correct"][valid].detach().cpu().numpy()

            all_probs.extend(probs.tolist())
            all_labels.extend(labels.tolist())

    if not all_labels:
        return {"auc": 0.5, "logloss": 0.693, "brier": 0.25}

    probs_np = np.clip(np.array(all_probs, dtype=np.float64), 1e-6, 1 - 1e-6)
    labels_np = np.array(all_labels, dtype=np.int32)

    try:
        auc = float(roc_auc_score(labels_np, probs_np))
    except ValueError:
        auc = 0.5

    return {
        "auc": round(auc, 5),
        "logloss": round(float(log_loss(labels_np, probs_np)), 5),
        "brier": round(float(brier_score_loss(labels_np, probs_np)), 5),
    }


def train(args) -> None:
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    sequences = load_sequences(Path(args.data))
    if len(sequences) < 20:
        raise ValueError("Not enough sequences. Need at least 20 learners with >=2 events.")

    random.shuffle(sequences)
    split = int(len(sequences) * 0.8)
    train_rows = sequences[:split]
    val_rows = sequences[split:]

    topic_to_id, module_to_id = build_vocabs(sequences)

    train_ds = SequenceDataset(train_rows, topic_to_id, module_to_id)
    val_ds = SequenceDataset(val_rows, topic_to_id, module_to_id)

    if len(train_ds) == 0 or len(val_ds) == 0:
        raise ValueError("Dataset split produced empty train/val set. Add more data.")

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, collate_fn=collate_batch)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, collate_fn=collate_batch)

    config = DKTConfig(
        num_topics=len(topic_to_id),
        num_modules=len(module_to_id),
        hidden_size=args.hidden_size,
        dropout=args.dropout,
    )

    device = "cuda" if torch.cuda.is_available() and not args.cpu else "cpu"
    model = DKTGRU(config).to(device)

    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    best_auc = -1.0
    best_state = None
    patience = args.patience
    stale = 0

    for epoch in range(1, args.epochs + 1):
        model.train()
        running_loss = 0.0

        for batch in train_loader:
            batch = {k: v.to(device) for k, v in batch.items()}
            logits = model(
                batch["topic_ids"],
                batch["module_ids"],
                batch["difficulty_ids"],
                batch["correctness_ids"],
                batch["gap_bucket_ids"],
                batch["recency_days"],
            )

            gather_idx = (batch["target_topic_ids"] - 1).clamp(min=0).unsqueeze(-1)
            selected_logits = torch.gather(logits, dim=2, index=gather_idx).squeeze(-1)

            valid = batch["mask"] > 0
            if valid.sum().item() == 0:
                continue

            loss = F.binary_cross_entropy_with_logits(
                selected_logits[valid],
                batch["target_correct"][valid],
            )

            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            running_loss += float(loss.item())

        metrics = evaluate(model, val_loader, device)
        print(f"epoch={epoch} train_loss={running_loss:.4f} val_auc={metrics['auc']} val_logloss={metrics['logloss']}")

        if metrics["auc"] > best_auc:
            best_auc = metrics["auc"]
            best_state = {k: v.detach().cpu() for k, v in model.state_dict().items()}
            stale = 0
        else:
            stale += 1
            if stale >= patience:
                print("Early stopping triggered")
                break

    if best_state is None:
        raise RuntimeError("Training finished without a valid checkpoint")

    out_dir = Path(args.artifacts)
    out_dir.mkdir(parents=True, exist_ok=True)

    torch.save(best_state, out_dir / "dkt_model.pt")

    metadata = {
        "trainedAt": datetime.utcnow().isoformat() + "Z",
        "model_config": vars(config),
        "training": {
            "seed": args.seed,
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "lr": args.lr,
            "dropout": args.dropout,
            "best_val_auc": best_auc,
            "train_sequences": len(train_ds),
            "val_sequences": len(val_ds),
        },
        "vocab": {
            "topic_to_id": topic_to_id,
            "module_to_id": module_to_id,
        },
    }

    with (out_dir / "metadata.json").open("w", encoding="utf-8") as fp:
        json.dump(metadata, fp, indent=2)

    model.load_state_dict(best_state, strict=False)
    val_metrics = evaluate(model, val_loader, device)
    with (out_dir / "metrics.json").open("w", encoding="utf-8") as fp:
        json.dump(val_metrics, fp, indent=2)

    print(f"Saved artifacts to {out_dir}")
    print(val_metrics)


def parse_args():
    parser = argparse.ArgumentParser(description="Train DKT GRU model")
    parser.add_argument("--data", default="artifacts/sequences.jsonl")
    parser.add_argument("--artifacts", default="artifacts")
    parser.add_argument("--epochs", type=int, default=20)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--hidden-size", type=int, default=96)
    parser.add_argument("--dropout", type=float, default=0.15)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--patience", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--cpu", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    train(args)
