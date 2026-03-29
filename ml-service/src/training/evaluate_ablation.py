from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Dict, List

import numpy as np
import torch
from sklearn.metrics import brier_score_loss, log_loss, roc_auc_score
from torch.utils.data import DataLoader

from src.app.model import DKTConfig, DKTGRU
from src.training.train_dkt import SequenceDataset, build_vocabs, collate_batch, load_sequences


DIFF_PARAMS = {
    "easy": {"guess": 0.25, "slip": 0.12, "transition": 0.18},
    "medium": {"guess": 0.2, "slip": 0.1, "transition": 0.14},
    "hard": {"guess": 0.15, "slip": 0.08, "transition": 0.1},
}


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def run_bkt_step(prior: float, is_correct: int, difficulty: str) -> float:
    params = DIFF_PARAMS.get(difficulty, DIFF_PARAMS["medium"])
    guess = params["guess"]
    slip = params["slip"]
    transition = params["transition"]

    prior = clamp(prior, 0.001, 0.999)
    if is_correct:
        numerator = prior * (1 - slip)
        denominator = numerator + (1 - prior) * guess
    else:
        numerator = prior * slip
        denominator = numerator + (1 - prior) * (1 - guess)

    posterior = numerator / denominator if denominator > 0 else prior
    return posterior + (1 - posterior) * transition


def eval_metrics(labels: List[int], probs: List[float]) -> Dict[str, float]:
    if not labels:
        return {"auc": 0.5, "logloss": 0.693, "brier": 0.25}

    y_true = np.array(labels, dtype=np.int32)
    y_prob = np.clip(np.array(probs, dtype=np.float64), 1e-6, 1 - 1e-6)

    try:
        auc = float(roc_auc_score(y_true, y_prob))
    except ValueError:
        auc = 0.5

    return {
        "auc": round(auc, 5),
        "logloss": round(float(log_loss(y_true, y_prob)), 5),
        "brier": round(float(brier_score_loss(y_true, y_prob)), 5),
    }


def calibration_report(labels: List[int], probs: List[float], bins: int = 10) -> Dict[str, object]:
    if not labels:
        return {
            "ece": 0.0,
            "mce": 0.0,
            "bins": [],
            "total": 0,
            "bin_count": bins,
        }

    y_true = np.array(labels, dtype=np.int32)
    y_prob = np.clip(np.array(probs, dtype=np.float64), 1e-6, 1 - 1e-6)
    edges = np.linspace(0.0, 1.0, bins + 1)

    total = len(y_true)
    ece = 0.0
    mce = 0.0
    rows = []

    for idx in range(bins):
        lo = float(edges[idx])
        hi = float(edges[idx + 1])
        if idx == bins - 1:
            mask = (y_prob >= lo) & (y_prob <= hi)
        else:
            mask = (y_prob >= lo) & (y_prob < hi)

        count = int(mask.sum())
        if count == 0:
            rows.append(
                {
                    "bin": idx,
                    "range": [round(lo, 3), round(hi, 3)],
                    "count": 0,
                    "mean_confidence": None,
                    "empirical_accuracy": None,
                    "gap": None,
                }
            )
            continue

        conf = float(y_prob[mask].mean())
        acc = float(y_true[mask].mean())
        gap = abs(acc - conf)

        ece += (count / total) * gap
        mce = max(mce, gap)

        rows.append(
            {
                "bin": idx,
                "range": [round(lo, 3), round(hi, 3)],
                "count": count,
                "mean_confidence": round(conf, 5),
                "empirical_accuracy": round(acc, 5),
                "gap": round(gap, 5),
            }
        )

    return {
        "ece": round(float(ece), 6),
        "mce": round(float(mce), 6),
        "bins": rows,
        "total": total,
        "bin_count": bins,
    }


def bkt_predictions(sequences: List[dict]) -> tuple[list[int], list[float]]:
    labels: list[int] = []
    probs: list[float] = []

    for seq in sequences:
        events = seq.get("events", [])
        topic_prior: Dict[str, float] = {}
        for event in events:
            topic_key = (event.get("topic") or "").strip().lower()
            prior = topic_prior.get(topic_key, 0.35)
            labels.append(int(event.get("is_correct", 0)))
            probs.append(float(prior))
            topic_prior[topic_key] = run_bkt_step(prior, labels[-1], event.get("difficulty", "medium"))

    return labels, probs


def dkt_predictions(sequences: List[dict], artifacts: Path) -> tuple[list[int], list[float]]:
    labels: list[int] = []
    probs: list[float] = []

    with (artifacts / "metadata.json").open("r", encoding="utf-8") as fp:
        metadata = json.load(fp)

    topic_to_id = metadata["vocab"]["topic_to_id"]
    module_to_id = metadata["vocab"]["module_to_id"]

    val_ds = SequenceDataset(sequences, topic_to_id, module_to_id)
    loader = DataLoader(val_ds, batch_size=32, shuffle=False, collate_fn=collate_batch)

    config = DKTConfig(**metadata["model_config"])
    model = DKTGRU(config)
    try:
        state = torch.load(artifacts / "dkt_model.pt", map_location="cpu", weights_only=True)
    except TypeError:
        state = torch.load(artifacts / "dkt_model.pt", map_location="cpu")
    model.load_state_dict(state)
    model.eval()

    with torch.no_grad():
        for batch in loader:
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

            valid = (batch["mask"] > 0) & (batch["target_topic_ids"] > 0)
            probs.extend(torch.sigmoid(selected_logits[valid]).cpu().numpy().tolist())
            labels.extend(batch["target_correct"][valid].cpu().numpy().astype(int).tolist())

    return labels, probs


def evaluate_bkt(sequences: List[dict]) -> Dict[str, float]:
    labels, probs = bkt_predictions(sequences)
    return eval_metrics(labels, probs)


def evaluate_dkt(sequences: List[dict], artifacts: Path) -> Dict[str, float]:
    labels, probs = dkt_predictions(sequences, artifacts)
    return eval_metrics(labels, probs)


def topk_precision_estimate(sequences: List[dict], k: int = 5) -> Dict[str, float]:
    # Simple proxy metric for product-facing recommendation quality.
    hits = 0
    total = 0

    for seq in sequences:
        events = seq.get("events", [])
        if len(events) < k + 1:
            continue

        weak_topics = [event["topic"] for event in events[:k] if int(event.get("is_correct", 0)) == 0]
        future_misses = {event["topic"] for event in events[k:] if int(event.get("is_correct", 0)) == 0}

        if not weak_topics:
            continue

        pred = set(weak_topics[:k])
        hits += len(pred.intersection(future_misses))
        total += len(pred)

    precision = hits / total if total else 0.0
    return {"topk_precision_proxy": round(precision, 5)}


def write_report(path: Path, bkt: dict, dkt: dict, topk: dict) -> None:
    delta_auc = round(dkt["auc"] - bkt["auc"], 5)
    delta_logloss = round(bkt["logloss"] - dkt["logloss"], 5)

    content = f"""# DKT Ablation Report\n\n## Summary\n- BKT AUC: {bkt['auc']}\n- DKT AUC: {dkt['auc']}\n- Delta AUC (DKT-BKT): {delta_auc}\n- BKT LogLoss: {bkt['logloss']}\n- DKT LogLoss: {dkt['logloss']}\n- Delta LogLoss (BKT-DKT): {delta_logloss}\n- BKT Brier: {bkt['brier']}\n- DKT Brier: {dkt['brier']}\n- Top-K Precision Proxy: {topk['topk_precision_proxy']}\n\n## Notes\n- Use this as reviewer evidence for model quality lift over classical baseline.\n- Recompute after each retraining cycle and attach to PR/release notes.\n"""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate BKT vs DKT ablation")
    parser.add_argument("--data", default="artifacts/sequences.jsonl")
    parser.add_argument("--artifacts", default="artifacts")
    parser.add_argument("--report", default="reports/latest_ablation.md")
    args = parser.parse_args()

    sequences = load_sequences(Path(args.data))
    if len(sequences) < 10:
        raise ValueError("Need at least 10 learner sequences for ablation")

    bkt = evaluate_bkt(sequences)
    dkt = evaluate_dkt(sequences, Path(args.artifacts))
    topk = topk_precision_estimate(sequences)

    write_report(Path(args.report), bkt, dkt, topk)

    print("BKT:", bkt)
    print("DKT:", dkt)
    print("TopK:", topk)
    print(f"Report written to {args.report}")


if __name__ == "__main__":
    main()
