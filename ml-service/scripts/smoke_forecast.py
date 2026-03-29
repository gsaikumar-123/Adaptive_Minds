from __future__ import annotations

import argparse
import json
import os
import statistics
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _utc_iso(days_ago: int) -> str:
    ts = datetime.now(tz=timezone.utc) - timedelta(days=days_ago)
    return ts.isoformat().replace("+00:00", "Z")


def _title_case(text: str) -> str:
    return " ".join(part.capitalize() for part in text.split())


def _load_artifact_vocab(artifacts_dir: Path) -> tuple[list[str], list[str]]:
    metadata_path = artifacts_dir / "metadata.json"
    if not metadata_path.exists():
        raise FileNotFoundError(f"Missing metadata file: {metadata_path}")

    data = json.loads(metadata_path.read_text(encoding="utf-8"))
    topics = list((data.get("vocab", {}).get("topic_to_id", {}) or {}).keys())
    modules = list((data.get("vocab", {}).get("module_to_id", {}) or {}).keys())
    if len(topics) < 3:
        raise ValueError("Need at least 3 topics in metadata vocab for smoke test")
    if len(modules) < 1:
        raise ValueError("Need at least 1 module in metadata vocab for smoke test")

    return topics, modules


def _build_seen_payload(topics: list[str], modules: list[str]) -> dict[str, Any]:
    t0, t1, t2 = topics[0], topics[1], topics[2]
    module_name = _title_case(modules[0])
    return {
        "learnerId": "smoke-seen-001",
        "domain": "python",
        "seedKey": "smoke-seen",
        "roadmapModules": [
            {
                "moduleName": module_name,
                "topics": [_title_case(t0), _title_case(t1), _title_case(t2), "Fallback Candidate"],
            }
        ],
        "questionEvents": [
            {
                "isCorrect": True,
                "difficulty": "easy",
                "modules": [module_name],
                "tags": [_title_case(t0)],
                "createdAt": _utc_iso(3),
            },
            {
                "isCorrect": False,
                "difficulty": "hard",
                "modules": [module_name],
                "tags": [_title_case(t1)],
                "createdAt": _utc_iso(2),
            },
            {
                "isCorrect": True,
                "difficulty": "medium",
                "modules": [module_name],
                "tags": [_title_case(t2)],
                "createdAt": _utc_iso(1),
            },
        ],
        "completedTopics": [_title_case(t0)],
    }


def _build_unseen_payload() -> dict[str, Any]:
    return {
        "learnerId": "smoke-unseen-001",
        "domain": "devops",
        "seedKey": "smoke-unseen",
        "roadmapModules": [
            {
                "moduleName": "DevOps Foundations",
                "topics": ["Docker Basics", "Kubernetes Intro", "CI/CD Pipelines", "Terraform Basics"],
            }
        ],
        "questionEvents": [
            {
                "isCorrect": True,
                "difficulty": "easy",
                "modules": ["DevOps Foundations"],
                "tags": ["Docker Basics"],
                "createdAt": _utc_iso(2),
            },
            {
                "isCorrect": False,
                "difficulty": "medium",
                "modules": ["DevOps Foundations"],
                "tags": ["Kubernetes Intro"],
                "createdAt": _utc_iso(1),
            },
        ],
        "completedTopics": [],
    }


def _post_remote(base_url: str, payload: dict[str, Any], api_key: str | None, timeout: float) -> dict[str, Any]:
    endpoint = f"{base_url.rstrip('/')}/v1/forecast"
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["x-api-key"] = api_key

    request = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {err.code} from forecast endpoint: {detail}") from err


def _post_inprocess(payload: dict[str, Any], api_key: str | None) -> dict[str, Any]:
    from src.app.main import forecast
    from src.app.schemas import ForecastRequest

    request_obj = ForecastRequest.model_validate(payload)
    return forecast(request_obj, x_api_key=(api_key or None))


def _assert_non_flat(name: str, forecast: dict[str, Any], min_std: float) -> dict[str, Any]:
    topics = forecast.get("topics") or []
    if not topics:
        raise AssertionError(f"{name}: response has no topics")

    probs = [float(row.get("masteryProbability", 0.0)) for row in topics]
    unique_probs = len({round(value, 4) for value in probs})
    std_value = statistics.pstdev(probs) if len(probs) > 1 else 0.0

    if unique_probs < 2:
        raise AssertionError(f"{name}: flat output detected (unique_probs={unique_probs})")
    if std_value < min_std:
        raise AssertionError(f"{name}: low-variance output detected (std={std_value:.6f} < {min_std})")

    return {
        "topicCount": len(topics),
        "uniqueProbabilities": unique_probs,
        "std": round(std_value, 6),
        "minProb": round(min(probs), 6),
        "maxProb": round(max(probs), 6),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke-test /v1/forecast with seen and unseen domain payloads")
    parser.add_argument("--artifacts", default="artifacts", help="Directory containing metadata.json")
    parser.add_argument("--base-url", default="", help="Optional URL of running ML service (e.g. http://127.0.0.1:8001)")
    parser.add_argument("--api-key", default=os.getenv("ML_SERVICE_API_KEY", ""), help="Optional x-api-key")
    parser.add_argument("--timeout", type=float, default=10.0, help="Remote HTTP timeout seconds")
    parser.add_argument("--min-std", type=float, default=1e-4, help="Minimum stddev for non-flat assertion")
    args = parser.parse_args()

    topics, modules = _load_artifact_vocab(Path(args.artifacts))

    seen_payload = _build_seen_payload(topics, modules)
    unseen_payload = _build_unseen_payload()

    sender = (
        (lambda payload: _post_remote(args.base_url, payload, args.api_key or None, args.timeout))
        if args.base_url
        else (lambda payload: _post_inprocess(payload, args.api_key or None))
    )

    seen_forecast = sender(seen_payload)
    unseen_forecast = sender(unseen_payload)

    seen_stats = _assert_non_flat("seen-domain", seen_forecast, args.min_std)
    unseen_stats = _assert_non_flat("unseen-domain", unseen_forecast, args.min_std)

    result = {
        "mode": "remote" if args.base_url else "inprocess",
        "seenDomain": seen_stats,
        "unseenDomain": unseen_stats,
        "status": "pass",
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as err:  # pragma: no cover
        print(json.dumps({"status": "fail", "error": str(err)}, indent=2))
        sys.exit(1)
