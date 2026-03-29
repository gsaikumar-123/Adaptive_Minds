from __future__ import annotations

import argparse
import json
from pathlib import Path

from src.training.evaluate_ablation import (
    evaluate_bkt,
    evaluate_dkt,
    load_sequences,
    topk_precision_estimate,
)


def to_float(value):
    try:
        return float(value)
    except Exception:
        return 0.0


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate reviewer-proof metric files for BKT vs DKT")
    parser.add_argument("--data", default="artifacts/sequences_debug.jsonl")
    parser.add_argument("--artifacts", default="artifacts")
    parser.add_argument("--out-json", default="results/model_quality_proof.json")
    parser.add_argument("--out-md", default="results/model_quality_proof.md")
    args = parser.parse_args()

    sequences = load_sequences(Path(args.data))
    if len(sequences) < 10:
        raise ValueError("Need at least 10 learner sequences to generate quality proof")

    bkt = evaluate_bkt(sequences)
    dkt = evaluate_dkt(sequences, Path(args.artifacts))
    topk = topk_precision_estimate(sequences)

    auc_delta = round(to_float(dkt.get("auc")) - to_float(bkt.get("auc")), 5)
    logloss_delta = round(to_float(bkt.get("logloss")) - to_float(dkt.get("logloss")), 5)
    brier_delta = round(to_float(bkt.get("brier")) - to_float(dkt.get("brier")), 5)

    win_auc = auc_delta > 0
    win_logloss = logloss_delta > 0
    win_brier = brier_delta > 0

    wins = sum([win_auc, win_logloss, win_brier])
    verdict = "DKT better" if wins >= 2 else "No clear win"

    payload = {
        "baseline": {"name": "BKT", "metrics": bkt},
        "candidate": {"name": "DKT", "metrics": dkt},
        "comparison": {
            "auc_delta_dkt_minus_bkt": auc_delta,
            "logloss_delta_bkt_minus_dkt": logloss_delta,
            "brier_delta_bkt_minus_dkt": brier_delta,
            "wins": {
                "auc": win_auc,
                "logloss": win_logloss,
                "brier": win_brier,
                "total": wins,
            },
            "topk_precision_proxy": topk.get("topk_precision_proxy"),
            "verdict": verdict,
            "decision_rule": "DKT is considered better if it wins at least 2/3 core metrics (AUC up, LogLoss down, Brier down).",
        },
    }

    out_json = Path(args.out_json)
    out_md = Path(args.out_md)
    out_json.parent.mkdir(parents=True, exist_ok=True)

    out_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    md = f"""# Model Quality Proof (BKT vs DKT)

## Decision Rule
DKT is considered better if it wins at least 2 of 3 core metrics:
- AUC higher is better
- LogLoss lower is better
- Brier lower is better

## Metrics
- BKT AUC: {bkt.get('auc')}
- DKT AUC: {dkt.get('auc')}
- Delta (DKT-BKT): {auc_delta}

- BKT LogLoss: {bkt.get('logloss')}
- DKT LogLoss: {dkt.get('logloss')}
- Delta (BKT-DKT): {logloss_delta}

- BKT Brier: {bkt.get('brier')}
- DKT Brier: {dkt.get('brier')}
- Delta (BKT-DKT): {brier_delta}

- Top-K Precision Proxy: {topk.get('topk_precision_proxy')}

## Verdict
- {verdict}
- Wins: {wins}/3 core metrics
"""

    out_md.write_text(md, encoding="utf-8")

    print(f"Saved: {out_json}")
    print(f"Saved: {out_md}")


if __name__ == "__main__":
    main()
