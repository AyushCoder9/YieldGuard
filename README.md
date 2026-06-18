# YieldGuard — Industrial Predictive Maintenance Platform

> Predict equipment failures **24 hours in advance** from live PLC/IoT sensor streams using XGBoost + LightGBM on 256 engineered features across 500k+ data points.

[![API](https://img.shields.io/badge/API-Live-00C896?style=flat-square)](https://yieldguard-api.onrender.com/health)
[![Dashboard](https://img.shields.io/badge/Dashboard-Streamlit-FF4B4B?style=flat-square)](https://yieldguard-app.streamlit.app)
[![Website](https://img.shields.io/badge/Website-Live-F0A500?style=flat-square)](https://yieldguard-app.vercel.app)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-21262D?style=flat-square)](LICENSE)

---

## Overview

YieldGuard is an end-to-end predictive maintenance system designed around the realities of industrial sensor data — noise, missing values, stuck sensors, class imbalance, and the strict requirement that no future information leaks into training. The system ingests readings from 6 sensor channels per machine, maintains a stateful 48-hour rolling buffer per machine, and returns a calibrated failure probability with SHAP-backed explanations in under 50ms.

**Why this problem is hard:**
- ~9% positive class rate — naive accuracy is useless, PR-AUC is the correct metric
- Time-series data — random K-fold cross-validation leaks future signal into training
- 50 machines in parallel — naive rolling features contaminate cross-machine boundaries
- 250+ features from only 6 raw channels — requires principled feature engineering, not brute force

---

## Live Demos

| Surface | URL | Notes |
|---|---|---|
| Interactive Demo | [yieldguard-app.vercel.app/demo](https://yieldguard-app.vercel.app/demo) | Isolated — no real API needed |
| Live Dashboard | [yieldguard-app.vercel.app/dashboard](https://yieldguard-app.vercel.app/dashboard) | Connects to live prediction API |
| Prediction API | [yieldguard-api.onrender.com](https://yieldguard-api.onrender.com/health) | FastAPI + Docker on Render |
| API Docs | [yieldguard-api.onrender.com/docs](https://yieldguard-api.onrender.com/docs) | Swagger UI |
| Streamlit Dashboard | [yieldguard-app.streamlit.app](https://yieldguard-app.streamlit.app) | Python dashboard |
| Uptime Monitor | [stats.uptimerobot.com/a5moAAPidW](https://stats.uptimerobot.com/a5moAAPidW) | Pings /health every 5 min |

> **Note:** API runs on Render free tier — first request may take ~30s to cold-start.

---

## Architecture

```
                       ┌─────────────────────────────────────────────┐
                       │              DATA PIPELINE                   │
                       │                                              │
   50 machines         │  SyntheticDataGenerator                     │
   6 channels    ───►  │    504k rows, 9.3% positive                 │
   10-min interval     │    Exponential degradation ramps            │
                       │    Quality issues injected                  │
                       │         │                                    │
                       │         ▼                                    │
                       │  DataPreprocessor                           │
                       │    Dedup → clip → stuck sensor              │
                       │    detection → resample → impute            │
                       │         │                                    │
                       │         ▼                                    │
                       │  FeatureEngineer (TransformerMixin)         │
                       │    256 features per-machine                 │
                       │    Rolling · EWMA · Lag · FFT · Cross       │
                       │         │                                    │
                       │         ▼                                    │
                       │  FailurePredictionTrainer                   │
                       │    XGBoost + LightGBM                       │
                       │    TimeSeriesExpandingCV (5-fold)           │
                       │    Optuna TPE HPO (50 trials)               │
                       │    Threshold tuned for max F1               │
                       └──────────────┬──────────────────────────────┘
                                      │ joblib artifacts
                                      ▼
                       ┌─────────────────────────────────────────────┐
                       │              SERVING LAYER                   │
                       │                                              │
   POST /predict ───►  │  PerMachineBuffer (288-sample deque)        │
   {machine_id,        │    → FeatureEngineer.transform()            │
    reading}           │    → model.predict_proba()                  │
                       │    → DriftMonitor.record()                  │
                       │    → PredictionResponse                     │
                       │                                              │
   POST /explain ───►  │  SHAP TreeExplainer (on-demand)             │
                       │                                              │
   GET /drift   ───►  │  PSI + KS test vs training reference        │
                       └─────────────────────────────────────────────┘
```

---

## Dataset

Synthetically generated to match real PLC/IIoT characteristics. All physics-based — not random noise.

| Property | Value |
|---|---|
| Machines | 50 |
| Duration | 70 days per machine |
| Sampling interval | 10 minutes |
| Total rows | 504,500 (before dedup) |
| Sensor channels | 6 |
| Positive class rate | ~9.3% |
| Failures per machine | 5–8 |
| Prediction horizon | 24 hours (144 samples) |

**Signal model per channel:**
```
X(t) = μ + seasonal(t) + degradation(t, t_fail) + spikes(t) + ε(t)

seasonal(t)    = A·sin(2πt/144 + φ),  A ~ U(5%, 15%) of μ
degradation(t) = direction · magnitude · (exp(α·progress) - 1) / (exp(α) - 1)
spikes(t)      = random transient anomalies, P=0.002, NOT failure-correlated
ε(t)           = heteroscedastic Gaussian, σ scales with |seasonal|
```

**Degradation physics per channel:**

| Channel | Baseline | Direction | Alpha | Effect |
|---|---|---|---|---|
| vibration_mm_s | 2.5 mm/s | ↑ | 3.0 | Bearing wear increases vibration exponentially |
| temperature_c | 65 °C | ↑ | 2.5 | Friction causes heating |
| pressure_bar | 8.0 bar | ↓ | 2.0 | Seal degradation drops pressure |
| current_a | 12.0 A | ↑ | 2.5 | Increased load draws more current |
| rpm | 1475 rpm | ↓ | 1.5 | Mechanical resistance slows shaft |
| acoustic_db | 72 dB | ↑ | 3.5 | Structural noise increases sharply |

**Injected data quality issues** (to demo realistic cleaning):
- 2–5% MCAR missing values per channel
- 3–8 stuck sensor windows (3–6 consecutive identical readings)
- ~0.5% out-of-range outliers
- ~0.1% duplicate timestamps

---

## Feature Engineering

`FeatureEngineer` is a fitted `sklearn.base.BaseEstimator, TransformerMixin` — serialized with `joblib` alongside the model on every training run to guarantee identical transformations at inference.

**Critical constraint**: ALL temporal operations run inside `for mid, g in df.groupby("machine_id")` — never on the flat concatenated DataFrame. Cross-machine boundary contamination is the most common subtle bug in multi-entity time-series feature engineering.

| Feature Group | Formula | Features |
|---|---|---|
| Rolling statistics | mean, std, range, skew, kurtosis × windows [6, 12, 36, 144] × 6 channels | 120 |
| EWMA + deviation | EMA(span) and (raw − EMA) × spans [12, 72] × 6 channels | 24 |
| Lag + diff + pct_change | shift(k), diff(k), pct_change(k).clip(−10,10) × lags [6, 12, 36, 144] × 6 | 72 |
| Rate of change | diff() and rolling(6).mean() of diff × 6 channels | 12 |
| FFT spectral | energy, dominant_hz, spectral_entropy × 6 channels | 18 |
| Cross-channel | current/rpm, current×vibration, pressure/temp, vibration×temp | 4 |
| **Total** | | **250** |

**Implementation notes:**
- New features collected in `dict`, single `pd.concat` per machine — no `PerformanceWarning` from fragmentation
- `pct_change.clip(-10, 10).replace([np.inf, -np.inf], np.nan)` — handles near-zero denominators
- FFT subsampled every 6 rows then forward-filled — avoids O(n) Python loop
- `freqs = np.fft.rfftfreq(w, d=600.0)` — gives Hz, not bin indices
- Entropy computed as `scipy.stats.entropy(power / (power.sum() + 1e-10))` — zero-division safe

---

## Model Training

### Cross-Validation: `TimeSeriesExpandingCV`

Extending `sklearn.model_selection.BaseCrossValidator` with pure time-based expanding window:

```
Fold 1:  [──────── train ────────────]  [gap]  [── val ──]
Fold 2:  [──────────── train ──────────────]  [gap]  [── val ──]
...

gap = 144 samples = 24 hours
```

- 5 folds, `gap_samples=144`, `min_train_size=50,000`
- **All 50 machines present in both train and val** (different time windows)
- 144-sample gap: a positive sample at train tail cannot have its failure event inside the val window — eliminates label leakage

### Class Imbalance

`scale_pos_weight = n_neg / n_pos ≈ 9.8`. **No SMOTE** — SMOTE creates synthetic samples by interpolating between existing points, which produces temporally impossible feature vectors in time-series data (e.g. a synthetic sample with lag-144 features from machine A and lag-12 features from machine B).

### Hyperparameter Optimization

Optuna TPE (Tree-structured Parzen Estimator) sampler, `seed=42`, `n_trials=50`:

**XGBoost search space:**
```python
max_depth         : int   [4, 10]
learning_rate     : float [0.01, 0.1]  (log scale)
subsample         : float [0.6, 1.0]
colsample_bytree  : float [0.5, 0.9]
reg_alpha         : float [0.0, 1.0]
reg_lambda        : float [0.0, 1.0]
min_child_weight  : int   [3, 10]
```

**LightGBM** — same + `num_leaves: int [31, 127]`

Objective: mean PR-AUC across 3-fold inner CV.

### Final Refit Strategy

```python
best_iteration = int(np.median([r.best_iteration for r in fold_results]))
model = build_model(n_estimators=best_iteration, early_stopping=False)
model.fit(X_full, y_full)
```

Median across folds is robust to outlier folds. No early stopping on refit — the val set used during CV is part of the full training set.

### Threshold Tuning

Sweeps `t ∈ [0.1, 0.9]` (step 0.01) on each CV fold, selects `argmax F1`. Final threshold = mean across folds.

### Results

| Model | PR-AUC | ROC-AUC | F1 | Precision | Recall | Threshold |
|---|---|---|---|---|---|---|
| **XGBoost** | **0.851** | **0.926** | 0.783 | 0.748 | 0.821 | 0.42 |
| LightGBM | 0.843 | 0.919 | 0.779 | 0.745 | 0.814 | 0.44 |

PR-AUC is the primary metric — with ~9% positive class, ROC-AUC is misleading (a model predicting all-negative gets ROC-AUC ≈ 0.5, PR-AUC ≈ 0.09).

### Top Predictive Features

| Rank | Feature | Importance | Interpretation |
|---|---|---|---|
| 1 | vibration_roll144_mean | 7.42% | 24h rolling vibration average captures slow degradation trend |
| 2 | temperature_ema72_dev | 6.81% | Deviation from 12h EWMA — detects thermal anomaly onset |
| 3 | vibration_fft_energy | 6.34% | Spectral energy increase signals bearing defect frequencies |
| 4 | pressure_diff144 | 5.98% | 24h pressure drop is leading indicator of seal failure |
| 5 | acoustic_roll144_mean | 5.71% | Sustained noise increase (not transient spike) |
| 6 | current_over_rpm | 5.23% | Current/RPM ratio — mechanical efficiency degradation proxy |
| 7 | rpm_lag144 | 4.89% | 24h lagged RPM — captures gradual shaft slowdown |
| 8 | vibration_roll36_std | 4.52% | Short-window vibration variance — instability onset |

---

## Serving API

FastAPI application deployed on Render (Docker). State maintained in-process — no Redis/DB dependency.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Status, uptime, model loaded, machines buffered |
| `GET` | `/model/info` | — | Active model name, PR-AUC, ROC-AUC, threshold, feature count |
| `GET` | `/machines` | — | All buffered machines + warm status + sample count |
| `POST` | `/predict` | `x-api-key` | Single reading → failure probability, risk level, top factors |
| `POST` | `/predict/batch` | `x-api-key` | Batch of readings → list of responses |
| `POST` | `/explain` | `x-api-key` | SHAP TreeExplainer values for a machine |
| `GET` | `/drift/report` | — | PSI scores + KS test results vs training reference |
| `GET` | `/features/importance` | — | Top 30 features from eval artifacts |

### Predict Request / Response

```bash
curl -X POST https://yieldguard-api.onrender.com/predict \
  -H "x-api-key: $YIELDGUARD_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "M-001",
    "reading": {
      "timestamp": "2024-06-06T12:00:00Z",
      "vibration_mm_s": 4.2,
      "temperature_c": 74.1,
      "pressure_bar": 6.8,
      "current_a": 15.3,
      "rpm": 1421,
      "acoustic_db": 84.7
    }
  }'
```

```json
{
  "machine_id": "M-001",
  "failure_probability": 0.7834,
  "risk_level": "HIGH",
  "prediction_horizon": "24h",
  "top_risk_factors": [
    { "feature": "vibration_roll144_mean", "importance": 0.0742, "direction": "increasing" },
    { "feature": "temperature_ema72_dev",  "importance": 0.0681, "direction": "increasing" }
  ],
  "buffer_status": "warm",
  "samples_in_buffer": 288,
  "timestamp": "2024-06-06T12:00:01Z"
}
```

**Buffer semantics:** First 288 readings for a new `machine_id` return `buffer_status: "warming_up"` with `failure_probability: 0.0`. This is by design — the feature engineer needs 144 samples for the longest rolling window. The buffer is a stateful `deque(maxlen=288)` stored in-process per machine.

### Drift Monitoring

```json
GET /drift/report
{
  "overall_status": "WARNING",
  "drifted_features": ["vibration_roll144_mean", "temperature_ema72_dev"],
  "psi_scores": {
    "vibration_roll144_mean": 0.134,
    "temperature_ema72_dev": 0.112
  }
}
```

PSI thresholds: `< 0.10` stable · `0.10–0.20` warning (investigate) · `> 0.20` critical (retrain). KS test triggers alert at `p < 0.01`.

---

## Project Structure

```
YieldGuard/
├── src/yieldguard/
│   ├── data/
│   │   ├── synthesizer.py       SyntheticDataGenerator — signal model + degradation physics
│   │   └── preprocessor.py      DataPreprocessor — cleaning, imputation, stuck sensor detection
│   ├── features/
│   │   └── engineer.py          FeatureEngineer(TransformerMixin) — 256 features
│   ├── models/
│   │   ├── trainer.py           FailurePredictionTrainer — CV + Optuna HPO
│   │   └── evaluator.py         ModelEvaluator — metrics, SHAP artifacts
│   ├── serving/
│   │   ├── api.py               FastAPI app — AppState, all endpoints
│   │   ├── schemas.py           Pydantic v2 — Field bounds from config
│   │   ├── feature_buffer.py    PerMachineBuffer — stateful 288-sample history
│   │   └── drift.py             DriftMonitor — PSI + KS test
│   └── utils/
│       ├── cv.py                TimeSeriesExpandingCV
│       └── io.py                joblib/parquet/yaml helpers
├── dashboard/app.py             Streamlit multi-page dashboard
├── configs/
│   ├── config.yaml              All hyperparams, sensor bounds, paths, seeds
│   └── model_registry.json      Active model tracking
├── web/                         Next.js 15 website
│   ├── app/page.tsx             Landing page
│   ├── app/demo/page.tsx        Interactive demo (isolated, no real API)
│   └── app/dashboard/page.tsx  Live API-connected dashboard
├── Dockerfile                   python:3.11-slim for Render
└── Makefile                     Pipeline + dev commands
```

---

## Quick Start

### Prerequisites

```bash
# macOS only — required for XGBoost
brew install libomp
```

### Setup

```bash
git clone https://github.com/AyushCoder9/YieldGuard.git
cd YieldGuard

python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

### Run Full Pipeline

```bash
make pipeline    # generate-data → preprocess → features → train
# ~1 hour total (50 Optuna trials × 2 models)
```

### Individual Steps

```bash
make generate-data   # ~30s  — 504k synthetic rows
make preprocess      # ~20s  — clean, impute
make features        # ~5min — 256 features engineered
make train           # ~60min — XGBoost + LightGBM with HPO
```

### Serve Locally

```bash
make serve        # FastAPI on :8000
make dashboard    # Streamlit on :8501
cd web && npm run dev  # Next.js on :3000
```

### Test a Prediction

```bash
curl -X POST http://localhost:8000/predict \
  -H "x-api-key: dev-key" \
  -H "Content-Type: application/json" \
  -d '{
    "machine_id": "M-001",
    "reading": {
      "timestamp": "2024-06-01T00:00:00Z",
      "vibration_mm_s": 3.1,
      "temperature_c": 68.0,
      "pressure_bar": 7.9,
      "current_a": 13.0,
      "rpm": 1470,
      "acoustic_db": 73.5
    }
  }'
```

### Quality

```bash
make lint        # ruff check src/ dashboard/
make typecheck   # mypy src/yieldguard
make test        # pytest tests/ -v
```

---

## Tech Stack

| Category | Tool | Version |
|---|---|---|
| ML — Boosting | XGBoost | 2.1.x |
| ML — Boosting | LightGBM | 4.4.x |
| ML — Pipelines | scikit-learn | 1.5.x |
| HPO | Optuna | 3.6.x |
| Explainability | SHAP (TreeExplainer) | 0.45.x |
| Data | Pandas + NumPy | 2.2 / 1.26 |
| Statistics | SciPy | 1.13.x |
| API Framework | FastAPI + Uvicorn | 0.115 / 0.30 |
| Validation | Pydantic v2 | 2.7.x |
| Serialization | joblib | 1.4.x |
| Config | PyYAML | 6.0.x |
| Linting | Ruff | latest |
| Types | Mypy | latest |
| Dashboard | Streamlit + Plotly | 1.35 / 5.22 |
| Website | Next.js 15 + Recharts | 15.5.19 |
| API Deploy | Render (Docker) | — |
| Dashboard Deploy | Streamlit Community Cloud | — |
| Website Deploy | Vercel | — |

---

## Key Design Decisions

**Why PR-AUC instead of ROC-AUC?**
With ~9% positive class, a model that predicts all-negative achieves ROC-AUC ≈ 0.5 but PR-AUC ≈ 0.09 (equal to random). PR-AUC penalizes false negatives appropriately for rare-event detection.

**Why no SMOTE?**
SMOTE interpolates between feature vectors of the same class. For time-series features (lags, rolling windows), this creates impossible synthetic samples — e.g., lag-144 features from one time step with lag-12 features from a different machine. `scale_pos_weight` handles imbalance without corrupting the feature space.

**Why per-machine groupby loop, not vectorized?**
Rolling, lag, and EWMA features computed on the flat concatenated DataFrame would bleed across machine boundaries — e.g., the first row of M-002 would compute a lag-144 feature using rows from M-001. All temporal features run inside `for mid, g in df.groupby("machine_id")`.

**Why `FeatureEngineer` serialized as `TransformerMixin`?**
The engineer is not stateless — `fit()` records reference statistics for drift monitoring and saves `feature_names_out_`. Serializing it alongside the model (joblib) guarantees identical transformations between training and inference. A mismatch in feature order or column names at inference is a silent, hard-to-debug failure.

**Why separate `/explain` endpoint?**
SHAP `TreeExplainer` adds ~100–200ms per call. The `/predict` path should be fast enough for real-time monitoring loops. Explanation is only needed on-demand by human operators.

---

## Environment Variables

| Variable | Service | Description |
|---|---|---|
| `YIELDGUARD_API_KEY` | Render (API) | Auth key for protected endpoints |
| `API_URL` | Streamlit Cloud | Points to Render API URL |
| `YIELDGUARD_API_KEY` | Streamlit Cloud | Same key as API |
| `NEXT_PUBLIC_API_URL` | Vercel | API base URL for frontend |
| `NEXT_PUBLIC_API_KEY` | Vercel | API key for dashboard page |

---

## License

MIT
