from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from pymongo import MongoClient


DIFFICULTIES = {"easy", "medium", "hard"}


def normalize(text: str) -> str:
    return (text or "").strip().lower()


def pick_topic(question_doc: dict) -> str:
    tags = question_doc.get("tags") or []
    modules = question_doc.get("modules") or []
    if tags:
        return tags[0]
    if modules:
        return modules[0]
    return "General Foundations"


def pick_module(question_doc: dict) -> str:
    modules = question_doc.get("modules") or []
    tags = question_doc.get("tags") or []
    if modules:
        return modules[0]
    if tags:
        return tags[0]
    return "General Foundations"


def to_iso(value) -> str:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc).isoformat()
    return datetime.now(tz=timezone.utc).isoformat()


def main() -> None:
    parser = argparse.ArgumentParser(description="Export learner sequences from MongoDB to JSONL")
    parser.add_argument("--mongo-uri", required=True)
    parser.add_argument("--db-name", default="adaptive_roadmap")
    parser.add_argument("--output", default="artifacts/sequences.jsonl")
    args = parser.parse_args()

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    client = MongoClient(args.mongo_uri)
    db = client[args.db_name]

    attempts = list(db.attempts.find({}, {"_id": 1, "userId": 1}).sort("_id", 1))
    attempt_to_user = {str(a["_id"]): str(a.get("userId")) for a in attempts}

    questions = list(db.questions.find({}, {"_id": 1, "tags": 1, "modules": 1, "difficulty": 1}))
    question_map = {str(q["_id"]): q for q in questions}

    answers = list(
        db.answers.find({}, {"attemptId": 1, "questionId": 1, "isCorrect": 1, "createdAt": 1}).sort("createdAt", 1)
    )

    learners = {}
    for answer in answers:
        attempt_id = str(answer.get("attemptId"))
        user_id = attempt_to_user.get(attempt_id)
        if not user_id:
            continue

        question_id = str(answer.get("questionId"))
        question = question_map.get(question_id)
        if not question:
            continue

        difficulty = normalize(question.get("difficulty") or "medium")
        if difficulty not in DIFFICULTIES:
            difficulty = "medium"

        learners.setdefault(user_id, []).append(
            {
                "topic": pick_topic(question),
                "module": pick_module(question),
                "difficulty": difficulty,
                "is_correct": 1 if answer.get("isCorrect") else 0,
                "timestamp": to_iso(answer.get("createdAt")),
            }
        )

    with out_path.open("w", encoding="utf-8") as fp:
        for learner_id, events in learners.items():
            events = sorted(events, key=lambda item: item["timestamp"])
            if len(events) < 2:
                continue

            prev_ts = None
            for event in events:
                current = datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00"))
                if prev_ts is None:
                    gap_days = 0.0
                else:
                    gap_days = max(0.0, (current - prev_ts).total_seconds() / (60 * 60 * 24))
                prev_ts = current
                event["time_gap_days"] = round(gap_days, 4)

            fp.write(json.dumps({"learner_id": learner_id, "events": events}, ensure_ascii=True) + "\n")

    print(f"Exported {len(learners)} learner sequence candidates to {out_path}")


if __name__ == "__main__":
    main()
