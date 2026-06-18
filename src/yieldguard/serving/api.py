from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="YieldGuard API",
    description="Predictive maintenance for industrial PLC/IoT sensor streams",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_API_KEY = os.getenv("YIELDGUARD_API_KEY", "dev-key")
_START_TIME = datetime.now(timezone.utc)


async def verify_key(x_api_key: str = Header(...)) -> None:
    if x_api_key != _API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


@app.get("/health", tags=["system"])
async def health() -> dict[str, Any]:
    uptime = (datetime.now(timezone.utc) - _START_TIME).total_seconds()
    return {
        "status": "ok",
        "version": "0.1.0",
        "uptime_seconds": round(uptime, 1),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/model/info", tags=["system"])
async def model_info() -> dict[str, Any]:
    return {
        "status": "no_model_loaded",
        "message": "Model training in progress. Check back soon.",
        "version": "skeleton-0.1",
        "features_count": 0,
        "training_date": None,
    }


@app.post("/predict", tags=["inference"], dependencies=[Depends(verify_key)])
async def predict(payload: dict[str, Any]) -> dict[str, Any]:
    """Single-machine failure prediction. Real model wired in Step 16."""
    return {
        "machine_id": payload.get("machine_id", "unknown"),
        "failure_probability": 0.0,
        "risk_level": "LOW",
        "prediction_horizon": "24h",
        "top_risk_factors": [],
        "buffer_status": "warming_up",
        "status": "model_not_trained",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/predict/batch", tags=["inference"], dependencies=[Depends(verify_key)])
async def predict_batch(payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [await predict(p) for p in payload]


@app.post("/explain", tags=["inference"], dependencies=[Depends(verify_key)])
async def explain(payload: dict[str, Any]) -> dict[str, Any]:
    """SHAP explanation for a single machine. Wired in Step 17."""
    return {
        "machine_id": payload.get("machine_id", "unknown"),
        "shap_values": [],
        "status": "model_not_trained",
    }


@app.get("/drift/report", tags=["monitoring"])
async def drift_report() -> dict[str, Any]:
    return {
        "overall_status": "no_reference_data",
        "drifted_features": [],
        "psi_scores": {},
        "ks_results": {},
        "message": "Drift monitor initialises after first model training run.",
    }
