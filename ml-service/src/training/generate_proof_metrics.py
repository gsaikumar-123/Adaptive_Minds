from __future__ import annotations

import argparse
import json
from pathlib import Path

from src.training.evaluate_ablation import (
    bkt_predictions,
    calibration_report,
    dkt_predictions,
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
    bkt_labels, bkt_probs = bkt_predictions(sequences)
    dkt_labels, dkt_probs = dkt_predictions(sequences, Path(args.artifacts))

    bkt_calibration = calibration_report(bkt_labels, bkt_probs, bins=10)
    dkt_calibration = calibration_report(dkt_labels, dkt_probs, bins=10)

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
        "calibration": {
            "baseline": {
                "name": "BKT",
                "ece": bkt_calibration.get("ece"),
                "mce": bkt_calibration.get("mce"),
                "reliabilityCurve": bkt_calibration.get("bins", []),
            },
            "candidate": {
                "name": "DKT",
                "ece": dkt_calibration.get("ece"),
                "mce": dkt_calibration.get("mce"),
                "reliabilityCurve": dkt_calibration.get("bins", []),
            },
            "delta": {
                "ece_reduction_bkt_minus_dkt": round(to_float(bkt_calibration.get("ece")) - to_float(dkt_calibration.get("ece")), 6),
                "mce_reduction_bkt_minus_dkt": round(to_float(bkt_calibration.get("mce")) - to_float(dkt_calibration.get("mce")), 6),
            },
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

## Calibration (Interview-grade)
- BKT ECE: {bkt_calibration.get('ece')}
- DKT ECE: {dkt_calibration.get('ece')}
- ECE Reduction (BKT-DKT): {round(to_float(bkt_calibration.get('ece')) - to_float(dkt_calibration.get('ece')), 6)}
- BKT MCE: {bkt_calibration.get('mce')}
- DKT MCE: {dkt_calibration.get('mce')}
- MCE Reduction (BKT-DKT): {round(to_float(bkt_calibration.get('mce')) - to_float(dkt_calibration.get('mce')), 6)}

### Reliability Curve (DKT, 10 bins)
{chr(10).join([f"- Bin {row['bin']} [{row['range'][0]}, {row['range'][1]}): count={row['count']}, conf={row['mean_confidence']}, acc={row['empirical_accuracy']}, gap={row['gap']}" for row in dkt_calibration.get('bins', [])])}

### Reliability Curve (BKT, 10 bins)
{chr(10).join([f"- Bin {row['bin']} [{row['range'][0]}, {row['range'][1]}): count={row['count']}, conf={row['mean_confidence']}, acc={row['empirical_accuracy']}, gap={row['gap']}" for row in bkt_calibration.get('bins', [])])}
"""

    out_md.write_text(md, encoding="utf-8")

    print(f"Saved: {out_json}")
    print(f"Saved: {out_md}")


if __name__ == "__main__":
    main()
