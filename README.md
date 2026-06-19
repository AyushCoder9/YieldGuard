# YieldGuard

> Know which machine will fail — a full day before it does.

YieldGuard is an industrial predictive maintenance platform that detects equipment failures **24 hours in advance** using LightGBM on 196 engineered features from 6 sensor channels. The model runs entirely in the browser — no backend cold-start, no API dependency, instant results.

---

## Live

| Surface | URL |
|---|---|
| Web App | [yield-guard-nine.vercel.app](https://yield-guard-nine.vercel.app) |
| API (FastAPI) | [yieldguard-api.onrender.com/health](https://yieldguard-api.onrender.com/health) |
| Dashboard (Streamlit) | [yieldguard-app.streamlit.app](https://yieldguard-app.streamlit.app) |

---

## What it does

YieldGuard watches 6 sensor channels per machine in real time:

| Channel | Sensor | Unit |
|---|---|---|
| Vibration | Accelerometer | mm/s |
| Temperature | RTD / thermocouple | °C |
| Pressure | Pressure transducer | bar |
| Current | CT clamp | A |
| RPM | Tachometer / encoder | rpm |
| Acoustic | Microphone / AE sensor | dB |

From a 5-day sliding history (~720 readings), the system computes 196 statistical features and scores them through a 270-tree LightGBM ensemble, then maps the raw score to a calibrated failure probability with an isotonic regression layer.

Output: a probability (0–100%) and a risk level (OPERATIONAL / WARNING / HIGH / CRITICAL) with a ranked list of the sensor signals driving the prediction.

---

## Model

### Training data

Synthesized from a physically-grounded signal model:
- **50 machines × 70 days** at 10-minute intervals → 500,000+ sensor readings
- **Degradation physics**: exponential ramp over 288 samples (48h) before each failure event; randomised onset, magnitude, and shape per event
- **Hard negatives**: recoverable excursions that look like early degradation but don't lead to failure — forces the model beyond naive threshold rules
- **Machine variation**: ±20% inter-machine baseline scatter, heteroscedastic noise
- **Data quality**: MCAR missing values (2–5%), stuck sensors (3–8 events/machine), out-of-range spikes, 5% label noise on positives
- **Label**: `failure_within_24h` — binary, 24h lookahead (lookahead samples = 144)

### Feature engineering (196 portable features)

Per sensor channel × 6 channels:

| Feature family | Features |
|---|---|
| Rolling stats | mean, std, range, skew, kurtosis — windows [6, 12, 36, 144] |
| EWMA | ema12, ema72, ema_deviation × 2 spans |
| Lag / diff / pct_change | lag6/12/36/144, diff, pct_change (clipped [-10, 10]) |
| Rate-of-change | ROC over [6, 12, 36, 144] |
| FFT (144-sample DFT) | energy, dominant frequency, spectral entropy |
| Cross-channel | vibration/temperature ratio, current/rpm ratio, pressure drop × current |

All temporal features computed **per machine** (inside `groupby('machine_id')`) — no cross-machine boundary contamination.

### Training methodology

- **Split**: `TimeSeriesExpandingCV` — 5 chronological folds, expanding train window, 24h gap (144 samples) between train tail and validation head to prevent label leakage
- **HPO**: Optuna TPE sampler, 20 trials, optimising PR-AUC on 3-fold inner CV
- **Imbalance**: `scale_pos_weight` = neg/pos ratio per model (no SMOTE, no oversampling)
- **Refit**: final model refitted on all data, `n_estimators` = median `best_iteration_` across folds (no early stopping on refit)
- **Calibration**: isotonic regression on held-out last 20% of data by time → honest probability estimates

### Results

| Model | PR-AUC | ROC-AUC | Threshold | Trees |
|---|---|---|---|---|
| **LightGBM** (exported) | **0.8561** | **0.9753** | 0.614 | 270 |
| XGBoost | 0.8567 | 0.9746 | 0.612 | 647 |

PR-AUC is the primary metric. With ~9% positive rate, random baseline PR-AUC ≈ 0.09. A score of 0.85 means the model separates real pre-failure signals from normal variation with high precision.

### Top features (by gain importance)

```
pressure_bar_roll144_mean       — sustained pressure drop over 24h
pressure_bar_fft_energy         — pressure oscillation energy
vibration_mm_s_fft_energy       — high-frequency vibration energy
current_a_roll144_mean          — sustained current draw increase
vibration_mm_s_roll144_mean     — long-term vibration trend
vibration_mm_s_ema72            — exponentially-weighted vibration level
current_a_fft_energy            — current harmonic energy
acoustic_db_roll144_mean        — sustained acoustic level increase
rpm_roll144_mean                — rotor speed drift over 24h
temperature_c_roll144_mean      — sustained temperature rise
```

---

## In-browser inference engine

The LightGBM model is exported and runs entirely in TypeScript inside the browser:

```
web/lib/engine/
  features.ts   — port of FeatureEngineer: rolling, EWMA, lag, FFT, cross-channel
  model.ts      — tree-ensemble scorer: walk LightGBM JSON trees + sigmoid + calibration
  explain.ts    — risk drivers: z-scored feature deviation × gain importance → ranked
  predict.ts    — orchestration: SensorWindow → features → score → explain → Result
```

Engine artifacts (generated by `scripts/export_model.py`):
```
web/public/lib/engine/
  model.json           — 270 LightGBM trees (3.7 MB)
  feature_spec.json    — 196 portable feature names, baselines, importances
  demo_scenarios.json  — 5 machine scenarios with actual model predictions
```

The TypeScript engine and Python training code share feature ordering through `feature_spec.json` — the JSON file is the contract between the two runtimes.

---

## Architecture

```
Browser (Next.js on Vercel)
├── /demo       → demo-data.ts + engine/ (hardcoded fleet, live inference)
├── /dashboard  → CSV upload or sliders → engine/ → ResultPanel
├── /guide      → How to use + CSV column reference
└── /about      → Methodology, metrics, architecture

Python (offline, training source of truth)
├── src/yieldguard/data/synthesizer.py     — synthetic PLC sensor data
├── src/yieldguard/data/preprocessor.py   — cleaning, imputation
├── src/yieldguard/features/engineer.py   — 196-feature FeatureEngineer
├── src/yieldguard/models/trainer.py      — XGBoost + LightGBM with CV + Optuna
├── src/yieldguard/models/evaluator.py    — metrics, SHAP artifacts
├── src/yieldguard/serving/api.py         — FastAPI (retained as reference)
└── scripts/export_model.py               — export to web/public/lib/engine/
```

No runtime API dependency. The web app is fully self-contained.

---

## Local development

### Python pipeline

```bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# Full pipeline: synthesize → preprocess → features → train
make pipeline

# Export trained model to browser
python scripts/export_model.py

# Individual steps
make generate-data
make preprocess
make features
make train
```

### Web app

```bash
cd web
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm run start        # serve production build
```

### Tests

```bash
# Python (72 tests): unit + integration + artifact verification
.venv/bin/python3 -m pytest tests/ -v

# TypeScript (19 tests): engine unit tests
cd web && npm run test

# E2E Playwright (19 tests): all routes, key flows
cd web && npm run test:e2e
```

Full test run: **110 tests** across three suites.

---

## Use cases

| Industry | Machine | Failure modes caught |
|---|---|---|
| CNC machining | Spindles, ball screws | Vibration harmonic shift, bearing runout |
| Fluid systems | Pumps, compressors | Pressure drop, cavitation signature |
| HVAC | Chillers, fans | Current creep, RPM drift |
| Manufacturing | Conveyor drives, motors | Torque ripple, thermal runout |

---

## Tech stack

| Layer | Technology |
|---|---|
| ML | LightGBM, XGBoost, Optuna, scikit-learn, SHAP |
| Data | NumPy, pandas, SciPy |
| Backend | FastAPI (reference), Uvicorn, Pydantic v2 |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| UI | framer-motion, recharts, lucide-react |
| Testing | pytest, vitest, Playwright |
| Infra | Vercel (web), Render (API), Streamlit Cloud (dashboard) |

---

## Config

All hyperparameters, sensor bounds, and paths live in `configs/config.yaml`. Nothing is hardcoded in source files.

Key parameters:
```yaml
data:
  n_machines: 50
  duration_days: 70
  failure_lookahead_samples: 144   # 24h at 10-min intervals
  degradation_window_samples: 288  # 48h degradation ramp
  hard_negative_rate: 0.06
  baseline_variation_pct: 0.20

model:
  cv_n_splits: 5
  cv_gap_samples: 144              # prevents label leakage
  optuna_n_trials: 20
```

---

## Deployment

| Service | Platform | Notes |
|---|---|---|
| Web | Vercel | Auto-deploys from main |
| API | Render (Docker) | `GET /health` pinged every 5 min by UptimeRobot |
| Dashboard | Streamlit Community Cloud | Reads `API_URL` + `YIELDGUARD_API_KEY` from secrets |

API env vars: `YIELDGUARD_API_KEY`

---

## Repository structure

```
YieldGuard/
├── configs/config.yaml           — all hyperparameters + sensor bounds
├── src/yieldguard/               — Python ML package
│   ├── data/                     — synthesizer, preprocessor
│   ├── features/                 — FeatureEngineer (scikit-learn Transformer)
│   ├── models/                   — trainer, evaluator
│   ├── serving/                  — FastAPI app, drift monitor, feature buffer
│   └── utils/                    — CV, IO helpers
├── scripts/export_model.py       — export LightGBM → web/public/lib/engine/
├── tests/                        — 72 Python unit + integration tests
├── web/                          — Next.js app
│   ├── app/                      — pages: /, /demo, /dashboard, /guide, /about
│   ├── components/               — Navbar, Footer, UI kit
│   ├── lib/engine/               — TypeScript inference engine
│   ├── public/lib/engine/        — model.json, feature_spec.json, demo_scenarios.json
│   └── tests/                    — 19 TS unit tests + 19 E2E Playwright tests
├── models/                       — trained .joblib artifacts + training_summary.json
├── dashboard/app.py              — Streamlit dashboard
└── Makefile                      — pipeline + dev commands
```
