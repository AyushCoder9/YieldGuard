from __future__ import annotations

import os
import time

import plotly.graph_objects as go
import requests
import streamlit as st

API_URL = os.getenv("API_URL", "http://localhost:8000")
API_KEY = os.getenv("YIELDGUARD_API_KEY", "dev-key")

st.set_page_config(
    page_title="YieldGuard — Predictive Maintenance",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.image(
        "https://img.shields.io/badge/YieldGuard-v0.1-blue?style=for-the-badge",
    )
    st.markdown("### YieldGuard")
    st.caption("AI-powered failure prediction for industrial PLC/IoT sensor streams")
    st.divider()
    st.markdown("**Stack**")
    st.markdown(
        "- XGBoost / LightGBM\n"
        "- 250+ engineered features\n"
        "- FastAPI + Streamlit\n"
        "- SHAP explainability\n"
        "- PSI drift monitoring"
    )
    st.divider()
    st.markdown("**Links**")
    st.markdown("[GitHub](https://github.com/AyushCoder9/YieldGuard) · [API Docs](/docs)")


# ── API health check (handles Render cold-start) ──────────────────────────────
@st.cache_data(ttl=30)
def get_api_health() -> dict:
    headers = {"x-api-key": API_KEY}
    for _ in range(8):
        try:
            r = requests.get(f"{API_URL}/health", headers=headers, timeout=6)
            if r.ok:
                return r.json()
        except Exception:
            time.sleep(3)
    return {"status": "unreachable"}


@st.cache_data(ttl=60)
def get_model_info() -> dict:
    try:
        r = requests.get(f"{API_URL}/model/info", timeout=6)
        return r.json() if r.ok else {}
    except Exception:
        return {}


# ── Header ────────────────────────────────────────────────────────────────────
st.title("🏭 YieldGuard — Predictive Maintenance")
st.caption(
    "Real-time failure prediction for 50 industrial machines using PLC/IoT sensor data."
)

with st.spinner("Connecting to prediction service (may take ~30s on cold start)..."):
    health = get_api_health()

if health.get("status") == "ok":
    st.success(f"API online ✓  |  Uptime: {health.get('uptime_seconds', '?')}s")
else:
    st.warning("Prediction service unreachable — showing demo mode.")

st.divider()

# ── Tabs ──────────────────────────────────────────────────────────────────────
tab_overview, tab_eda, tab_predictions, tab_performance, tab_drift = st.tabs(
    ["Overview", "EDA Explorer", "Predictions", "Model Performance", "Drift Monitor"]
)

# ── Overview ──────────────────────────────────────────────────────────────────
with tab_overview:
    model = get_model_info()
    model_status = model.get("status", "unknown")

    col1, col2, col3, col4 = st.columns(4)
    col1.metric("Machines Monitored", "50")
    col2.metric("Sensor Channels", "6")
    col3.metric("Prediction Horizon", "24 h")
    col4.metric(
        "Model Status",
        "Live" if model_status not in ("no_model_loaded", "unknown") else "Training...",
    )

    st.markdown("### Architecture")
    st.markdown(
        """
| Layer | Implementation |
|---|---|
| Data synthesis | 504k-row synthetic PLC dataset — 50 machines × 6 sensors × 70 days |
| Feature engineering | 250+ rolling, lag, EWMA, FFT, cross-channel features |
| Model | XGBoost + LightGBM, Optuna HPO, time-series CV with 24h gap |
| Serving | FastAPI + stateful per-machine buffer + Pydantic v2 validation |
| Monitoring | PSI + Kolmogorov-Smirnov drift detection |
| Dashboard | Streamlit + Plotly |
"""
    )

    st.info(
        "🚧 **Full dashboard is being wired up.** "
        "Data synthesis → feature engineering → model training in progress. "
        "All tabs will populate automatically as each pipeline step completes."
    )

# ── EDA Explorer ─────────────────────────────────────────────────────────────
with tab_eda:
    st.markdown("### Sensor EDA Explorer")
    st.info("Raw sensor time-series, distribution plots, and failure event annotations will appear here after `make generate-data` completes.")

    # Demo placeholder chart
    st.markdown("#### Preview: Expected vibration signal shape")
    import numpy as np

    t = np.linspace(0, 10080, 10080)
    signal = (
        2.5
        + 0.3 * np.sin(2 * np.pi * t / 144)
        + np.where(t > 8500, 0.5 * np.exp((t - 8500) / 500) - 0.5, 0)
        + np.random.default_rng(42).normal(0, 0.8, 10080)
    )
    failure_idx = 9200

    fig = go.Figure()
    fig.add_trace(go.Scatter(x=t[:failure_idx], y=signal[:failure_idx], name="Normal", line=dict(color="#2196F3", width=1)))
    fig.add_trace(go.Scatter(x=t[failure_idx:], y=signal[failure_idx:], name="Degradation zone", line=dict(color="#F44336", width=1)))
    fig.add_vline(x=failure_idx - 144, line_dash="dash", line_color="orange", annotation_text="24h warning window")
    fig.update_layout(
        title="Vibration (mm/s) — synthetic signal preview",
        xaxis_title="Sample index",
        yaxis_title="Vibration (mm/s)",
        height=350,
        template="plotly_dark",
    )
    st.plotly_chart(fig, use_container_width=True)

# ── Predictions ───────────────────────────────────────────────────────────────
with tab_predictions:
    st.markdown("### Live Failure Probability")
    st.info("Per-machine gauges and risk ranking will appear here after model training completes.")

    # Demo gauges (placeholder values)
    st.markdown("#### Preview: Expected gauge layout")
    cols = st.columns(5)
    demo_machines = [
        ("M-001", 0.87, "CRITICAL"),
        ("M-012", 0.61, "HIGH"),
        ("M-007", 0.34, "MEDIUM"),
        ("M-023", 0.12, "LOW"),
        ("M-041", 0.05, "LOW"),
    ]
    for col, (mid, prob, risk) in zip(cols, demo_machines):
        color = {"CRITICAL": "red", "HIGH": "orange", "MEDIUM": "yellow", "LOW": "green"}[risk]
        fig = go.Figure(go.Indicator(
            mode="gauge+number",
            value=prob * 100,
            title={"text": mid},
            gauge={
                "axis": {"range": [0, 100]},
                "bar": {"color": color},
                "steps": [
                    {"range": [0, 20], "color": "#1a1a1a"},
                    {"range": [20, 50], "color": "#1a1a1a"},
                    {"range": [50, 80], "color": "#1a1a1a"},
                    {"range": [80, 100], "color": "#1a1a1a"},
                ],
            },
            number={"suffix": "%"},
        ))
        fig.update_layout(height=200, margin=dict(l=10, r=10, t=30, b=10), template="plotly_dark")
        col.plotly_chart(fig, use_container_width=True)
        col.caption(f"Risk: **:{color}[{risk}]**")

# ── Model Performance ─────────────────────────────────────────────────────────
with tab_performance:
    st.markdown("### Model Performance")
    st.info("PR curves, ROC curves, confusion matrix, SHAP beeswarm, and feature importance plots will appear here after model training.")
    st.markdown(
        """
**Target metrics:**
| Metric | Target |
|---|---|
| PR-AUC | > 0.80 |
| ROC-AUC | > 0.90 |
| Recall @ 90% Precision | > 0.70 |
| F1 (tuned threshold) | > 0.75 |
"""
    )

# ── Drift Monitor ─────────────────────────────────────────────────────────────
with tab_drift:
    st.markdown("### Data Drift Monitor")
    st.info("PSI scores, KS test p-values, and drift trend history will appear here after the drift monitor is initialised.")
    st.markdown(
        """
**PSI interpretation:**
- `< 0.1` — stable, no drift
- `0.1–0.2` — moderate drift, investigate
- `> 0.2` — severe drift, retrain recommended
"""
    )
