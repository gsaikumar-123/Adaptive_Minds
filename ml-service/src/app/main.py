from __future__ import annotations

import os

from fastapi import FastAPI, Header, HTTPException

from .schemas import ForecastRequest

app = FastAPI(title="Adaptive Roadmap ML Service", version="1.0.0")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "ml-forecast"}


@app.post("/v1/forecast")
def forecast(payload: ForecastRequest, x_api_key: str | None = Header(default=None)) -> dict:
    expected = os.getenv("ML_SERVICE_API_KEY")
    if expected and x_api_key != expected:
        raise HTTPException(status_code=401, detail="Invalid ML service key")

    try:
        # Lazy import keeps /health lightweight when heavy ML deps are unavailable.
        from .inference import run_inference

        return run_inference(payload)
    except FileNotFoundError as err:
        raise HTTPException(status_code=503, detail=f"Model artifacts not available: {err}") from err
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Inference failed: {err}") from err
