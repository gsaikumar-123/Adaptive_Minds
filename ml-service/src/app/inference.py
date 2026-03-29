from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import torch

from .model import DKTConfig, DKTGRU
from .schemas import ForecastRequest


DIFFICULTY_TO_ID = {"easy": 1, "medium": 2, "hard": 3}


class ArtifactStore:
    def __init__(self, domain: str | None = None) -> None:
        self.domain = _normalize(domain or "")
        self._loaded = False
        self.model: DKTGRU | None = None
        self.metadata: dict = {}
        self.topic_to_id: Dict[str, int] = {}
        self.module_to_id: Dict[str, int] = {}
        self.id_to_topic: Dict[int, str] = {}
        self.device = os.getenv("ML_INFERENCE_DEVICE", "cpu")

    def load(self) -> None:
        if self._loaded:
            return

        artifact_root = Path(os.getenv("ML_MODEL_ARTIFACT_DIR", "./artifacts"))

        slug = self.domain.replace(" ", "-")
        candidates = []
        if slug:
            candidates.append(artifact_root / slug)
            candidates.append(artifact_root / slug.replace("-", "_"))
            candidates.append(artifact_root / self.domain.replace(" ", "_"))
        candidates.append(artifact_root)

        metadata_path = None
        model_path = None
        for candidate in candidates:
            current_meta = candidate / "metadata.json"
            current_model = candidate / "dkt_model.pt"
            if current_meta.exists() and current_model.exists():
                metadata_path = current_meta
                model_path = current_model
                break

        if metadata_path is None or model_path is None:
            raise FileNotFoundError("Missing artifacts: expected metadata.json and dkt_model.pt")

        with metadata_path.open("r", encoding="utf-8") as fp:
            self.metadata = json.load(fp)

        self.topic_to_id = self.metadata["vocab"]["topic_to_id"]
        self.module_to_id = self.metadata["vocab"]["module_to_id"]
        self.id_to_topic = {int(v): k for k, v in self.topic_to_id.items()}

        config = DKTConfig(**self.metadata["model_config"])
        model = DKTGRU(config)

        try:
            state = torch.load(model_path, map_location=self.device, weights_only=True)
        except TypeError:
            state = torch.load(model_path, map_location=self.device)
        model.load_state_dict(state)
        model.eval()
        model.to(self.device)

        self.model = model
        self._loaded = True


class ArtifactRegistry:
    def __init__(self) -> None:
        self._stores: Dict[str, ArtifactStore] = {}

    def for_domain(self, domain: str) -> ArtifactStore:
        key = _normalize(domain or "") or "default"
        if key not in self._stores:
            self._stores[key] = ArtifactStore(domain=key)
        return self._stores[key]


ARTIFACTS = ArtifactRegistry()


def _normalize(text: str) -> str:
    return (text or "").strip().lower()


def _topic_from_event(event) -> str:
    if event.tags:
        return event.tags[0]
    if event.modules:
        return event.modules[0]
    return "General Foundations"


def _module_from_event(event) -> str:
    if event.modules:
        return event.modules[0]
    if event.tags:
        return event.tags[0]
    return "General Foundations"


def _bucket_gap(days: float) -> int:
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


def _to_event_tensors(req: ForecastRequest, store: ArtifactStore) -> Tuple[torch.Tensor, ...]:
    events = sorted(req.questionEvents, key=lambda item: item.createdAt or datetime(1970, 1, 1, tzinfo=timezone.utc))

    topic_ids = []
    module_ids = []
    difficulty_ids = []
    correctness_ids = []
    gap_bucket_ids = []
    recency_days = []

    prev_ts = None
    for event in events:
        topic_name = _normalize(_topic_from_event(event))
        module_name = _normalize(_module_from_event(event))

        topic_ids.append(store.topic_to_id.get(topic_name, 0))
        module_ids.append(store.module_to_id.get(module_name, 0))
        difficulty_ids.append(DIFFICULTY_TO_ID.get(_normalize(event.difficulty), 2))
        correctness_ids.append(2 if event.isCorrect else 1)

        current_ts = event.createdAt or datetime.now(tz=timezone.utc)
        if prev_ts is None:
            gap_days = 0.0
        else:
            gap_days = max(0.0, (current_ts - prev_ts).total_seconds() / (60 * 60 * 24))
        prev_ts = current_ts

        gap_bucket_ids.append(_bucket_gap(gap_days))

        # Keep this aligned with training where recency is modeled from inter-event gap.
        recency_days.append(min(gap_days, 365.0) / 365.0)

    if not topic_ids:
        topic_ids = [0]
        module_ids = [0]
        difficulty_ids = [2]
        correctness_ids = [0]
        gap_bucket_ids = [1]
        recency_days = [0.0]

    device = store.device
    return (
        torch.tensor([topic_ids], dtype=torch.long, device=device),
        torch.tensor([module_ids], dtype=torch.long, device=device),
        torch.tensor([difficulty_ids], dtype=torch.long, device=device),
        torch.tensor([correctness_ids], dtype=torch.long, device=device),
        torch.tensor([gap_bucket_ids], dtype=torch.long, device=device),
        torch.tensor([recency_days], dtype=torch.float32, device=device),
    )


def _confidence(evidence_count: int, latest_days: float) -> int:
    base = min(85.0, math.sqrt(max(0, evidence_count)) * 27.0)
    freshness_penalty = min(28.0, latest_days * 0.9)
    return int(max(20.0, min(97.0, base + 15.0 - freshness_penalty)))


def _recommendation(mastery: int, confidence: int) -> str:
    if mastery >= 80 and confidence >= 55:
        return "Maintain"
    if mastery >= 55:
        return "Reinforce"
    return "Priority Focus"


def _module_index(roadmap_modules: List[dict]) -> Dict[str, int]:
    return {_normalize(item.get("moduleName", "")): idx for idx, item in enumerate(roadmap_modules)}


def _clamp_prob(value: float) -> float:
    return float(max(0.02, min(0.98, value)))


def _fallback_unknown_probability(
    module_name: str,
    module_prob_index: Dict[str, float],
    global_model_prob: float,
    learner_success_prior: float,
    evidence_count: int,
    correct_count: int,
) -> float:
    module_prior = module_prob_index.get(_normalize(module_name), global_model_prob)
    blended = 0.5 * module_prior + 0.35 * learner_success_prior + 0.15 * global_model_prob

    if evidence_count > 0:
        evidence_prior = (correct_count + 1.0) / (evidence_count + 2.0)
        blended = 0.55 * evidence_prior + 0.45 * blended

    return _clamp_prob(blended)


def _apply_prereq_rerank(topic_rows: List[dict], roadmap_modules: List[dict]) -> List[dict]:
    module_idx = _module_index(roadmap_modules)

    module_mastery: Dict[str, List[int]] = {}
    for row in topic_rows:
        key = _normalize(row["moduleName"])
        module_mastery.setdefault(key, []).append(row["masteryScore"])

    module_avg = {k: (sum(v) / len(v) if v else 50.0) for k, v in module_mastery.items()}

    for row in topic_rows:
        idx = module_idx.get(_normalize(row["moduleName"]), 0)
        if idx <= 0:
            row["adjustedPriority"] = row["priorityScore"]
            continue

        previous_modules = [key for key, value in module_idx.items() if value < idx]
        if not previous_modules:
            row["adjustedPriority"] = row["priorityScore"]
            continue

        prereq_gap = max(0.0, 70.0 - (sum(module_avg.get(m, 70.0) for m in previous_modules) / len(previous_modules)))
        penalty = min(18.0, prereq_gap * 0.25)
        row["adjustedPriority"] = int(max(0.0, row["priorityScore"] + penalty))

    return sorted(topic_rows, key=lambda item: item["adjustedPriority"], reverse=True)


def run_inference(req: ForecastRequest) -> dict:
    store = ARTIFACTS.for_domain(req.domain)
    store.load()
    assert store.model is not None

    tensors = _to_event_tensors(req, store)

    with torch.no_grad():
        logits = store.model(*tensors)
        final_logits = logits[0, -1]
        probs = torch.sigmoid(final_logits).detach().cpu().numpy().tolist()

    completed = {_normalize(topic) for topic in req.completedTopics}
    evidence_by_topic: Dict[str, int] = {}
    correct_by_topic: Dict[str, int] = {}
    last_seen_by_topic: Dict[str, float] = {}
    now = datetime.now(tz=timezone.utc)

    for event in req.questionEvents:
        topic = _normalize(_topic_from_event(event))
        evidence_by_topic[topic] = evidence_by_topic.get(topic, 0) + 1
        correct_by_topic[topic] = correct_by_topic.get(topic, 0) + (1 if event.isCorrect else 0)
        ts = event.createdAt or now
        days = max(0.0, (now - ts).total_seconds() / (60 * 60 * 24))
        if topic not in last_seen_by_topic or days < last_seen_by_topic[topic]:
            last_seen_by_topic[topic] = days

    global_model_prob = _clamp_prob(sum(probs) / max(1, len(probs)))
    total_events = len(req.questionEvents)
    total_correct = sum(1 for event in req.questionEvents if event.isCorrect)
    learner_success_prior = _clamp_prob((total_correct + 1.0) / (total_events + 2.0))

    module_prob_samples: Dict[str, List[float]] = {}
    for module in req.roadmapModules:
        module_key = _normalize(module.moduleName)
        for topic_name in module.topics:
            topic_id = store.topic_to_id.get(_normalize(topic_name))
            if topic_id and topic_id > 0:
                module_prob_samples.setdefault(module_key, []).append(float(probs[topic_id - 1]))
    module_prob_index = {
        key: _clamp_prob(sum(values) / len(values))
        for key, values in module_prob_samples.items()
        if values
    }

    topics = []
    for module in req.roadmapModules:
        for topic_name in module.topics:
            key = _normalize(topic_name)
            topic_id = store.topic_to_id.get(key)
            evidence_count = evidence_by_topic.get(key, 0)
            correct_count = correct_by_topic.get(key, 0)

            if topic_id and topic_id > 0:
                raw_prob = float(probs[topic_id - 1])
            else:
                raw_prob = _fallback_unknown_probability(
                    module_name=module.moduleName,
                    module_prob_index=module_prob_index,
                    global_model_prob=global_model_prob,
                    learner_success_prior=learner_success_prior,
                    evidence_count=evidence_count,
                    correct_count=correct_count,
                )

            if key in completed:
                raw_prob = max(raw_prob, 0.76)

            mastery_score = int(max(0.0, min(100.0, raw_prob * 100.0)))
            latest_days = last_seen_by_topic.get(key, 999.0)
            confidence = _confidence(evidence_count, latest_days)
            recommendation = _recommendation(mastery_score, confidence)
            priority = int(max(0.0, min(100.0, (100.0 - mastery_score) * (1 + (100 - confidence) / 140.0))))

            topics.append(
                {
                    "topic": topic_name,
                    "moduleName": module.moduleName,
                    "masteryProbability": round(float(raw_prob), 4),
                    "masteryScore": mastery_score,
                    "confidence": confidence,
                    "recommendation": recommendation,
                    "priorityScore": priority,
                    "evidenceCount": evidence_count,
                }
            )

    topics = _apply_prereq_rerank(topics, [item.model_dump() for item in req.roadmapModules])

    priority_now = [item for item in topics if item["recommendation"] != "Maintain"][:10]
    maintain = [item for item in topics if item["recommendation"] == "Maintain"][:10]

    avg_mastery = sum(item["masteryScore"] for item in topics) / max(1, len(topics))
    avg_conf = sum(item["confidence"] for item in topics) / max(1, len(topics))
    readiness = int(max(0.0, min(100.0, avg_mastery * 0.74 + avg_conf * 0.26)))

    selected = priority_now[:9]
    sessions = []
    for day in range(3):
        chunk = selected[day * 3 : (day + 1) * 3]
        if not chunk:
            continue
        sessions.append(
            {
                "day": day + 1,
                "focus": "Exploit weak-core" if day == 0 else "Explore uncertainty" if day == 1 else "Consolidate gains",
                "topics": [
                    {
                        "topic": item["topic"],
                        "moduleName": item["moduleName"],
                        "reason": f"adjustedPriority={item['adjustedPriority']}, confidence={item['confidence']}%",
                        "expectedGain": int((1 - item["masteryProbability"]) * max(0.2, item["adjustedPriority"] / 100.0) * 100),
                    }
                    for item in chunk
                ],
            }
        )

    expected_gain = sum(topic["expectedGain"] for day in sessions for topic in day["topics"])
    remaining = len([item for item in topics if item["masteryScore"] < 80])
    naive_days = max(1, math.ceil(remaining / 2))
    adaptive_days = max(1, math.ceil(naive_days * 0.72))

    return {
        "model": {
            "name": "Deep Knowledge Tracing",
            "version": "dkt-gru-v1",
            "notes": [
                "Sequence model predicts topic mastery from learner interaction history.",
                "Topic recommendations are re-ranked by prerequisite-aware module ordering.",
                "Confidence combines evidence volume with recency.",
                "Unknown topics use a blended prior from learner signal, module context, and observed evidence.",
            ],
        },
        "summary": {
            "readinessScore": readiness,
            "averageMasteryScore": int(avg_mastery),
            "averageConfidence": int(avg_conf),
            "totalTopics": len(topics),
            "totalEvidenceEvents": len(req.questionEvents),
        },
        "recommendations": {
            "priorityNow": priority_now,
            "maintain": maintain,
        },
        "policy": {
            "algorithm": "DKT + Prerequisite Re-ranker",
            "version": "dkt-rerank-v1",
            "selectedActions": selected,
            "sessions": sessions,
            "productivity": {
                "expectedGainScore": expected_gain,
                "naiveDays": naive_days,
                "adaptiveDays": adaptive_days,
                "estimatedDaysSaved": max(0, naive_days - adaptive_days),
            },
        },
        "topics": topics,
        "generatedAt": datetime.now(tz=timezone.utc).isoformat(),
    }
