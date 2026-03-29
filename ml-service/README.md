# ML Service (DKT + Prerequisite Re-ranking)

This package adds production-style ML capabilities to Adaptive Roadmap:
- Sequence model: Deep Knowledge Tracing (GRU)
- Baseline comparison: BKT metrics for ablation
- Inference API: FastAPI endpoint consumed by backend `/api/progress/forecast-v2`

## 1. Install
Python compatibility: tested with Python 3.12.

```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Export Training Data

```bash
python -m src.training.export_from_mongo --mongo-uri "mongodb://localhost:27017" --db-name adaptive_roadmap --output artifacts/sequences.jsonl
```

## 3. Train DKT

```bash
python -m src.training.train_dkt --data artifacts/sequences.jsonl --artifacts artifacts --epochs 20 --batch-size 32
```

Artifacts generated:
- `artifacts/dkt_model.pt`
- `artifacts/metadata.json`
- `artifacts/metrics.json`

## 4. Run Ablation

```bash
python -m src.training.evaluate_ablation --data artifacts/sequences.jsonl --artifacts artifacts --report reports/latest_ablation.md
```

## 5. Serve Inference API

```bash
copy .env.example .env
uvicorn src.app.main:app --host 0.0.0.0 --port 8001
```

Endpoints:
- `GET /health`
- `POST /v1/forecast`

## 6. Request Contract

Request payload:

```json
{
  "learnerId": "user-id",
  "domain": "python",
  "roadmapModules": [{ "moduleName": "Basics", "topics": ["Syntax", "Variables"] }],
  "questionEvents": [{
    "isCorrect": true,
    "difficulty": "medium",
    "modules": ["Basics"],
    "tags": ["Variables"],
    "createdAt": "2026-03-22T11:30:00.000Z"
  }],
  "completedTopics": ["Syntax"],
  "seedKey": "user:python:2026-03-23"
}
```

## 7. Production Notes

- Backend automatically falls back to baseline BKT if ML service is unavailable.
- Set backend env vars:
  - `ML_FORECAST_URL`
  - `ML_FORECAST_API_KEY`
  - `ML_FORECAST_TIMEOUT_MS`
- Re-train model on a schedule and version artifacts by date tag.

## 8. View Project-Level Comparison Results

You can generate same-input comparison logs for:
- baseline backend forecast behavior (without ML service)
- mixed backend+ml-service behavior (forecast-v2 style envelope)

Run from `backend/`:

```bash
npm run proof:compare
```

Then open:
- `ml-service/results/endpoint_comparison_same_input.md`
- `ml-service/results/endpoint_comparison_same_input.json`
