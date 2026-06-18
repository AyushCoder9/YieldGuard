"""Pydantic v2 request/response schemas with sensor bounds validation."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SensorReading(BaseModel):
    timestamp: datetime
    vibration_mm_s: float = Field(ge=0.0, le=50.0)
    temperature_c: float = Field(ge=0.0, le=200.0)
    pressure_bar: float = Field(ge=0.0, le=30.0)
    current_a: float = Field(ge=0.0, le=100.0)
    rpm: float = Field(ge=0.0, le=3000.0)
    acoustic_db: float = Field(ge=0.0, le=140.0)


class PredictionRequest(BaseModel):
    machine_id: str = Field(min_length=1, max_length=64)
    reading: SensorReading


class RiskFactor(BaseModel):
    feature: str
    importance: float
    direction: Literal["increasing", "decreasing", "neutral"]


class PredictionResponse(BaseModel):
    machine_id: str
    failure_probability: float
    risk_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    prediction_horizon: str = "24h"
    top_risk_factors: list[RiskFactor]
    buffer_status: Literal["warm", "warming_up"]
    samples_in_buffer: int
    timestamp: datetime


class BatchPredictionRequest(BaseModel):
    readings: list[PredictionRequest]


class ExplainRequest(BaseModel):
    machine_id: str


class ModelInfoResponse(BaseModel):
    status: str
    version: str | None = None
    model_name: str | None = None
    trained_at: str | None = None
    pr_auc: float | None = None
    roc_auc: float | None = None
    features_count: int | None = None
    threshold: float | None = None


class DriftReport(BaseModel):
    overall_status: Literal["OK", "WARNING", "CRITICAL", "no_reference_data"]
    drifted_features: list[str]
    psi_scores: dict[str, float]
    message: str | None = None
