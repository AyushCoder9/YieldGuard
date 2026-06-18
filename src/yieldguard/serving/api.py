from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from yieldguard.serving.schemas import (
    BatchPredictionRequest,
    DriftReport,
    ExplainRequest,
    ModelInfoResponse,
    PredictionRequest,
    PredictionResponse,
    RiskFactor,
)
from yieldguard.serving.feature_buffer import PerMachineBuffer
from yieldguard.serving.drift import DriftMonitor

logger = logging.getLogger(__name__)

app = FastAPI(
    title="YieldGuard API",
    description="Predictive maintenance for industrial PLC/IoT sensor streams",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_API_KEY = os.getenv("YIELDGUARD_API_KEY", "dev-key")
_START_TIME = datetime.now(timezone.utc)
_MODEL_DIR = Path(os.getenv("MODEL_DIR", "models"))
_EVAL_DIR = _MODEL_DIR / "eval"


# ── App state ─────────────────────────────────────────────────────────────────

class AppState:
    def __init__(self) -> None:
        self.model: Any = None
        self.feature_engineer: Any = None
        self.feature_names: list[str] = []
        self.threshold: float = 0.5
        self.model_info: dict = {}
        self.buffer = PerMachineBuffer()
        self.drift_monitor: DriftMonitor | None = None
        self.feature_importance: list[dict] = []

    def load(self) -> None:
        registry_path = Path("configs/model_registry.json")
        if not registry_path.exists():
            return
        try:
            with open(registry_path) as f:
                registry = json.load(f)
            active = registry.get("active")
            if not active:
                return
            import joblib
            model_path = _MODEL_DIR / f"{active}.joblib"
            if model_path.exists():
                self.model = joblib.load(model_path)
                logger.info("Loaded model: %s", model_path)

            # Load most recent feature engineer
            eng_paths = sorted(_MODEL_DIR.glob("feature_engineer_*.joblib"))
            if eng_paths:
                self.feature_engineer = joblib.load(eng_paths[-1])
                self.feature_names = self.feature_engineer.feature_names_out_
                logger.info("Loaded FeatureEngineer: %s", eng_paths[-1])

            # Load eval info
            entry = next((e for e in registry.get("entries", []) if e["name"] == active), {})
            self.threshold = entry.get("metrics", {}).get("threshold", 0.5)
            self.model_info = entry

            # Load feature importance from eval JSON
            eval_path = _EVAL_DIR / f"{active.split('_')[0]}_eval.json"
            if eval_path.exists():
                with open(eval_path) as f:
                    eval_data = json.load(f)
                self.feature_importance = eval_data.get("feature_importance", [])

            # Load drift monitor
            ref_paths = sorted(_MODEL_DIR.glob("reference_stats_*.json"))
            if not ref_paths and self.feature_engineer and hasattr(
                self.feature_engineer, "reference_stats_"
            ):
                self.drift_monitor = DriftMonitor(self.feature_engineer.reference_stats_)
            elif ref_paths:
                self.drift_monitor = DriftMonitor.from_json(ref_paths[-1])

        except Exception as e:
            logger.warning("Model load failed: %s", e)


_state = AppState()


@app.on_event("startup")
async def startup() -> None:
    _state.load()
    logger.info("API ready. Model loaded: %s", _state.model is not None)


# ── Auth ──────────────────────────────────────────────────────────────────────

async def verify_key(x_api_key: str = Header(...)) -> None:
    if x_api_key != _API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


# ── System ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["system"])
async def health() -> dict[str, Any]:
    uptime = (datetime.now(timezone.utc) - _START_TIME).total_seconds()
    return {
        "status": "ok",
        "version": "1.0.0",
        "model_loaded": _state.model is not None,
        "uptime_seconds": round(uptime, 1),
        "machines_buffered": len(_state.buffer.list_machines()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/model/info", tags=["system"], response_model=ModelInfoResponse)
async def model_info() -> ModelInfoResponse:
    if _state.model is None:
        return ModelInfoResponse(status="no_model_loaded", version="skeleton")
    entry = _state.model_info
    metrics = entry.get("metrics", {})
    return ModelInfoResponse(
        status="loaded",
        version=entry.get("name", "unknown"),
        model_name=entry.get("name", "").split("_")[0] if entry.get("name") else None,
        trained_at=entry.get("trained_at"),
        pr_auc=metrics.get("pr_auc"),
        roc_auc=metrics.get("roc_auc"),
        threshold=metrics.get("threshold"),
        features_count=len(_state.feature_names),
    )


@app.get("/machines", tags=["inference"])
async def list_machines() -> list[dict]:
    return _state.buffer.list_machines()


# ── Inference ─────────────────────────────────────────────────────────────────

@app.post("/predict", tags=["inference"], dependencies=[Depends(verify_key)])
async def predict(req: PredictionRequest) -> PredictionResponse:
    warm = _state.buffer.push(req.machine_id, req.reading)
    count = _state.buffer.samples_count(req.machine_id)

    if not warm or _state.model is None or _state.feature_engineer is None:
        return PredictionResponse(
            machine_id=req.machine_id,
            failure_probability=0.0,
            risk_level="LOW",
            top_risk_factors=[],
            buffer_status="warming_up",
            samples_in_buffer=count,
            timestamp=datetime.now(timezone.utc),
        )

    df = _state.buffer.to_dataframe(req.machine_id)
    df_feat = _state.feature_engineer.transform(df)
    feat_row = df_feat[_state.feature_names].iloc[[-1]]

    prob = float(_state.model.predict_proba(feat_row.values)[0, 1])
    risk = _risk_level(prob)

    top_factors = _top_risk_factors(feat_row, _state.feature_importance)

    if _state.drift_monitor:
        _state.drift_monitor.record(feat_row.iloc[0].to_dict())

    return PredictionResponse(
        machine_id=req.machine_id,
        failure_probability=round(prob, 4),
        risk_level=risk,
        top_risk_factors=top_factors,
        buffer_status="warm",
        samples_in_buffer=count,
        timestamp=datetime.now(timezone.utc),
    )


@app.post("/predict/batch", tags=["inference"], dependencies=[Depends(verify_key)])
async def predict_batch(req: BatchPredictionRequest) -> list[PredictionResponse]:
    return [await predict(r) for r in req.readings]


@app.post("/explain", tags=["inference"], dependencies=[Depends(verify_key)])
async def explain(req: ExplainRequest) -> dict[str, Any]:
    if _state.model is None or not _state.buffer.is_warm(req.machine_id):
        return {"status": "not_ready", "machine_id": req.machine_id, "shap_values": []}

    try:
        import shap
        df = _state.buffer.to_dataframe(req.machine_id)
        df_feat = _state.feature_engineer.transform(df)
        feat_row = df_feat[_state.feature_names].iloc[[-1]].values

        explainer = shap.TreeExplainer(_state.model)
        shap_vals = explainer.shap_values(feat_row)
        if isinstance(shap_vals, list):
            shap_vals = shap_vals[1]

        sv = shap_vals[0]
        results = sorted(
            [{"feature": f, "shap_value": round(float(v), 6)}
             for f, v in zip(_state.feature_names, sv)],
            key=lambda x: abs(x["shap_value"]), reverse=True
        )[:20]
        return {"machine_id": req.machine_id, "shap_values": results, "status": "ok"}
    except Exception as e:
        return {"status": "error", "message": str(e), "machine_id": req.machine_id}


@app.get("/drift/report", tags=["monitoring"], response_model=DriftReport)
async def drift_report() -> DriftReport:
    if _state.drift_monitor is None:
        return DriftReport(
            overall_status="no_reference_data",
            drifted_features=[],
            psi_scores={},
            message="Drift monitor initialises after model training.",
        )
    report = _state.drift_monitor.check_drift()
    return DriftReport(**report)


@app.get("/features/importance", tags=["system"])
async def feature_importance() -> list[dict]:
    return _state.feature_importance[:30]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _risk_level(prob: float) -> str:
    if prob >= 0.75:
        return "CRITICAL"
    if prob >= 0.50:
        return "HIGH"
    if prob >= 0.25:
        return "MEDIUM"
    return "LOW"


def _top_risk_factors(
    feat_row: pd.DataFrame, importance: list[dict]
) -> list[RiskFactor]:
    results = []
    for item in importance[:5]:
        fname = item["feature"]
        if fname not in feat_row.columns:
            continue
        val = feat_row[fname].iloc[0]
        direction = "increasing" if val > 0 else "decreasing" if val < 0 else "neutral"
        results.append(RiskFactor(
            feature=fname,
            importance=round(item["importance"], 4),
            direction=direction,
        ))
    return results
