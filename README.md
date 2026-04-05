# Adaptive Learning Roadmap Generator

An intelligent platform that generates personalized learning roadmaps using LLMs and ML. Users define their learning goal, take adaptive assessments, and receive a customized roadmap that skips what they already know.

## System Architecture

![System architecture diagram](System_Architecture.png)

The platform follows a three-layer flow:
- The React frontend collects goals, shows adaptive questions, and renders the roadmap/history views.
- The Express backend coordinates assessment generation, scoring, roadmap synthesis, and progress tracking.
- The FastAPI ML service provides DKT forecasts that complement the deterministic BKT and Skill DNA engines.

## Key Features

- **LLM-Generated MCQs** (Groq API): Real-time question generation tailored to learning goals
- **Adaptive Assessment**: Dynamic question selection using information-gain scoring
- **Skill DNA Engine**: Deterministic scoring with weighted accuracy, confidence, and hard-question risk
- **Bayesian Knowledge Tracing (BKT)**: Probabilistic learner modeling with forgetting decay
- **Deep Knowledge Tracing (DKT)**: GRU-based ML model (56% AUC, runs on FastAPI)
- **Thompson Sampling**: Contextual bandit algorithm for weekly study scheduling
- **Personalized Roadmaps**: Module-by-module learning paths with prerequisites

## Architecture

- Goal capture and intent analysis
- Adaptive MCQ generation with Groq-powered prompts
- Assessment scoring with Skill DNA, BKT, and DKT
- Roadmap synthesis and persistence in MongoDB
- Progress tracking and forecast history across previously generated roadmaps

## Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React (Vite), Vanilla CSS, React Router |
| **Backend** | Node.js, Express, MongoDB, Groq API |
| **ML Service** | FastAPI, PyTorch (GRU-RNN), Scikit-learn |

## Core Services

### 1. Skill DNA Engine
Deterministic learner scoring:
- Weighted accuracy: `difficulty_weight × correctness`
- Hard-question risk: `weighted_misses_on_hard / total_hard`
- Confidence: `√(attempts) × 11 + (weighted_attempts/10) × 8`
- Priority Index: `(100 − accuracy) × (1 + hard_risk × 0.9) × (1 + (100 − confidence)/200)`

### 2. Learning Forecast Engine
Bayesian learner model:
```
Mastery update: P(mastery | answer) using Bayes rule
Forgetting: mastery × exp(−0.015 × days_inactive)
Recommendations: "Priority Focus" / "Reinforce" / "Maintain"
```

### 3. Active Assessment Engine
Adaptive question selection:
```
expected_gain = (0.55 × uncertainty + 0.35 × weakness + 0.1 × novelty) / (1 + asked_count × 0.45)
Stop when: avg_gain < 0.34 AND avg_uncertainty < 0.22
```

### 4. Deep Knowledge Tracing (ML Service)
GRU-based RNN with embeddings (Topics + Modules + Difficulty + Temporal gaps)

## Project Structure

```
adaptive-roadmap/
├── frontend/                    # React UI (Vite)
│   └── src/
│       ├── components/          # UI components
│       ├── pages/               # Route pages (Assessment, History, Dashboard)
│       ├── services/            # API client
│       └── state/               # Auth context
├── backend/                     # Express API
│   └── src/
│       ├── controllers/         # Route handlers
│       ├── services/            # Business logic (Skill DNA, BKT, DKT)
│       ├── prompts/             # LLM system prompts
│       ├── models/              # MongoDB schemas
│       └── routes/              # API endpoints
└── ml-service/                  # FastAPI ML microservice
  ├── src/
  │   ├── app/                 # FastAPI server
  │   ├── training/            # DKT training scripts
  │   └── inference.py         # Model inference
  └── artifacts/               # dkt_model.pt + metadata.json
```

**Performance vs BKT:**
- AUC: +3.7% (0.6374 vs 0.5977)
- LogLoss: -53% (0.6662 vs 1.4222)
- Brier: -27% (0.2368 vs 0.3261)

## Getting Started

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Groq API Key
- Python 3.12 (for ML training)

### Installation

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

**ML Service (Optional):**
```bash
cd ml-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### Running Locally

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
# http://localhost:5000
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# http://localhost:5173
```

**Terminal 3 - ML Service:**
```bash
cd ml-service
.venv\Scripts\activate
uvicorn src.app.main:app --port 8001
```

### Environment Variables

**Backend** (`.env`):
```env
PORT=5000
MONGO_URI=mongodb+srv://user:pwd@cluster.mongodb.net/adaptive_roadmap
MONGO_DB=adaptive_roadmap
GROQ_API_KEY=your_key
JWT_SECRET=your_secret
FRONTEND_URL=http://localhost:5173
ML_FORECAST_URL=http://localhost:8001
ML_FORECAST_API_KEY=change_me
ML_FORECAST_TIMEOUT_MS=5000
```

**Frontend** (`.env`):
```env
VITE_API_URL=http://localhost:5000
```

## Validation Scripts

```bash
cd backend

# Test 1: Compare ML forecast vs baseline
npm run proof:compare

# Test 2: Test on real curricula
npm run proof:roadmap

# Test 3: Full system ablation (DKT vs BKT)
npm run proof:showcase
```

Results saved to `ml-service/results/`

## Training DKT Model

```bash
cd ml-service

# Export sequences
python -m src.training.export_from_mongo \
  --mongo-uri "mongodb+srv://user:pwd@cluster.mongodb.net" \
  --db-name adaptive_roadmap

# Train DKT
python -m src.training.train_dkt \
  --data artifacts/sequences.jsonl \
  --artifacts artifacts \
  --epochs 20

# Generate ablation report
python -m src.training.evaluate_ablation \
  --data artifacts/sequences.jsonl \
  --artifacts artifacts
```

## Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/assessment/start` | Begin assessment |
| POST | `/api/assessment/submit-answer` | Submit MCQ |
| GET | `/api/progress/forecast` | BKT forecast |
| GET | `/api/progress/forecast-v2` | BKT + DKT comparison |
| GET | `/api/roadmap/history` | Past roadmaps |

## Performance

- Cold start: ~10 sec
- Model size: 0.49 MB
- Response time: ~500ms (BKT), ~800ms (DKT)
- Daily limit: 3 assessments/user
