#!/usr/bin/env python3
"""Export trained LightGBM model + feature spec + demo scenarios to web/public/lib/engine/."""
from __future__ import annotations

import json
import sys
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from yieldguard.utils.io import load_config
from yieldguard.data.synthesizer import SyntheticDataGenerator
from yieldguard.features.engineer import FeatureEngineer

_PASSTHROUGH = {"machine_id", "timestamp", "failure_within_24h"}


def _select_window(
    df: pd.DataFrame,
    target: str,
    rng: np.random.Generator,
    window_size: int = 720,
) -> tuple[int, int]:
    """Pick a [start, end] window placing the machine in `target` risk state.

    Clusters consecutive positive-label runs and ends the window at a position
    INSIDE the cluster so the model prediction at the window tail is meaningful.
    """
    n = len(df)
    labels = df["failure_within_24h"].values
    pos_indices = np.where(labels == 1)[0].tolist()

    if target == "OPERATIONAL" or not pos_indices:
        for _ in range(300):
            end = int(rng.integers(window_size + 50, n - 10))
            start = end - window_size
            if start >= 0 and labels[max(0, end - 300) : end + 1].sum() == 0:
                return start, end
        # Fallback: first quarter, usually pre-failure
        end = min(window_size + 200, n - 1)
        return end - window_size, end

    # Group consecutive positives into clusters (gap > 200 = new cluster)
    clusters: list[list[int]] = []
    cur: list[int] = [pos_indices[0]]
    for idx in pos_indices[1:]:
        if idx - cur[-1] > 200:
            clusters.append(cur)
            cur = []
        cur.append(idx)
    clusters.append(cur)

    # Drop tiny clusters
    clusters = [c for c in clusters if len(c) >= 20]
    if not clusters:
        end = min(window_size + 200, n - 1)
        return end - window_size, end

    # Pick median cluster for stable cross-run behaviour
    cluster = clusters[len(clusters) // 2]

    # t_fail = one step after the last positive label in cluster
    t_fail = cluster[-1] + 1

    # Place window END relative to t_fail.
    # Degradation ramp spans [t_fail-288, t_fail]; label window [t_fail-144, t_fail].
    # Probed empirically: model output is binary (raw~0.04 → raw~0.84 in ~30 samples)
    # at the label-window boundary. Achievable calibrated-prob zones:
    #   CRITICAL : offset -10  (deep in label window)     → cal ~0.96
    #   HIGH     : offset -130 (14 samples into window)   → cal ~0.57
    #   OPERATIONAL handled above (clean window, no labels)
    offset_from_fail = {"CRITICAL": -10, "HIGH": -130}
    offset = offset_from_fail.get(target, -10)

    end = t_fail + offset
    end = max(window_size, min(end, n - 1))
    return end - window_size, end


def _run_inference(
    window: pd.DataFrame,
    fe: FeatureEngineer,
    lgb_model,
    cal_x: np.ndarray,
    cal_y: np.ndarray,
) -> tuple[list[float], float]:
    """Run model inference on a single-machine window. Returns (fp_list, final_fp)."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        feat_df = fe._transform_one_machine(window)

    feat_cols = [c for c in feat_df.columns if c not in _PASSTHROUGH]
    X = feat_df[feat_cols].astype(np.float32).values

    # LightGBM handles NaN natively (missing → default direction per tree node)
    probs = lgb_model.predict_proba(X)[:, 1]

    # Isotonic calibration via linear interpolation between knots
    if len(cal_x) > 0:
        calibrated = np.interp(probs, cal_x, cal_y)
    else:
        calibrated = probs

    calibrated = np.clip(calibrated, 0.0, 1.0)

    fp_list = [round(float(v), 4) for v in calibrated.tolist()]
    final_fp = float(np.mean(calibrated[-12:]))  # mean of last 12 samples (~2h)
    return fp_list, final_fp


def main() -> None:
    cfg = load_config()
    out_dir = Path("web/public/lib/engine")
    out_dir.mkdir(parents=True, exist_ok=True)

    # ── Load artifacts ────────────────────────────────────────────────────────
    summary_path = Path("models/training_summary.json")
    if not summary_path.exists():
        print("ERROR: models/training_summary.json not found. Run training first.")
        sys.exit(1)

    summary = json.loads(summary_path.read_text())
    lgb_entry = summary.get("lightgbm", {})
    lgb_path = Path(lgb_entry.get("artifact", ""))
    if not lgb_path.exists():
        print(f"ERROR: LightGBM artifact not found at {lgb_path}")
        sys.exit(1)

    fe_paths = sorted(Path("models").glob("feature_engineer_*.joblib"))
    if not fe_paths:
        print("ERROR: No feature_engineer_*.joblib found in models/")
        sys.exit(1)
    fe_path = fe_paths[-1]

    print(f"Loading model: {lgb_path}")
    print(f"Loading feature engineer: {fe_path}")
    lgb_model = joblib.load(lgb_path)
    fe: FeatureEngineer = joblib.load(fe_path)

    cal_x = np.array(lgb_entry.get("calibration_x", []))
    cal_y = np.array(lgb_entry.get("calibration_y", []))

    # ── Export model JSON ─────────────────────────────────────────────────────
    model_dict = lgb_model.booster_.dump_model()
    model_dict["threshold"] = lgb_entry.get("threshold", 0.5)
    model_dict["calibration_x"] = lgb_entry.get("calibration_x", [])
    model_dict["calibration_y"] = lgb_entry.get("calibration_y", [])
    model_dict["pr_auc"] = lgb_entry.get("pr_auc", 0.0)
    model_dict["roc_auc"] = lgb_entry.get("roc_auc", 0.0)

    (out_dir / "model.json").write_text(json.dumps(model_dict))
    print(f"Exported model.json ({len(model_dict.get('tree_info', []))} trees)")

    # ── Export feature spec ───────────────────────────────────────────────────
    portable_names = fe.get_portable_feature_names()
    booster = lgb_model.booster_
    # Model was fitted on .values → feature names are Column_0, Column_1, ...
    # Map by position to actual feature names
    lgb_feat_names = booster.feature_name()
    importance_raw = booster.feature_importance(importance_type="gain").tolist()
    if lgb_feat_names and lgb_feat_names[0].startswith("Column_"):
        # Position-based mapping: Column_i → portable_names[i]
        importance_dict = {
            portable_names[i]: float(importance_raw[i])
            for i in range(min(len(portable_names), len(importance_raw)))
        }
    else:
        importance_dict = dict(zip(lgb_feat_names, importance_raw))

    feature_spec = {
        "feature_names": portable_names,
        "rolling_windows": fe.rolling_windows,
        "ewma_spans": fe.ewma_spans,
        "lag_windows": fe.lag_windows,
        "fft_window": fe.fft_window,
        "sensor_cols": [
            "vibration_mm_s", "temperature_c", "pressure_bar",
            "current_a", "rpm", "acoustic_db",
        ],
        "features": {
            name: {
                "mean": float(fe.reference_stats_.get(name, {}).get("mean", 0.0)),
                "std": float(max(fe.reference_stats_.get(name, {}).get("std", 1.0), 1e-6)),
                "importance": float(importance_dict.get(name, 0.0)),
            }
            for name in portable_names
        },
        "sensor_baselines": {
            col: {
                "mean": float(cfg["sensors"][col]["baseline_mean"]),
                "std": float(cfg["sensors"][col]["baseline_std"]),
                "bounds": cfg["sensors"][col]["bounds"],
                "degradation_direction": int(cfg["sensors"][col]["degradation_direction"]),
            }
            for col in ["vibration_mm_s", "temperature_c", "pressure_bar", "current_a", "rpm", "acoustic_db"]
        },
    }

    (out_dir / "feature_spec.json").write_text(json.dumps(feature_spec, indent=2))
    print(f"Exported feature_spec.json ({len(portable_names)} portable features)")

    # ── Generate demo scenarios ───────────────────────────────────────────────
    gen = SyntheticDataGenerator(cfg)
    scenarios = []
    rng = np.random.default_rng(42)

    machine_meta = [
        ("Compressor A",     "Centrifugal Compressor", "Hall A",            3, "OPERATIONAL"),
        ("Pump Station 2",   "Submersible Pump",       "Basement",          7, "CRITICAL"),
        ("CNC Mill #3",      "CNC Machine",            "Workshop",          2, "HIGH"),
        ("HVAC Unit B",      "HVAC System",            "Roof Level",        5, "OPERATIONAL"),
        ("Conveyor Belt 5",  "Belt Conveyor",          "Production Line 2", 8, "CRITICAL"),
    ]
    sensor_cols = ["vibration_mm_s", "temperature_c", "pressure_bar", "current_a", "rpm", "acoustic_db"]

    for i, (name, mtype, location, age, target_status) in enumerate(machine_meta):
        mid = f"DEMO-{i + 1:02d}"
        df_single = gen._generate_machine(mid)
        total = len(df_single)

        start_idx, end_idx = _select_window(df_single, target_status, rng)
        window = df_single.iloc[start_idx : end_idx + 1].reset_index(drop=True)

        # Median-impute missing sensor values for clean export
        for col in sensor_cols:
            window[col] = window[col].fillna(window[col].median())

        # Actual model inference for probability series
        try:
            fp_list, final_fp = _run_inference(window, fe, lgb_model, cal_x, cal_y)
        except Exception as exc:
            print(f"  Warning: inference failed for {mid} ({exc}); using label-based fallback")
            labels = window["failure_within_24h"].astype(float)
            fp_raw = labels.rolling(window=72, min_periods=1).mean()
            fp_list = [round(float(v), 4) for v in fp_raw.tolist()]
            final_fp = float(fp_list[-1])

        # Derive displayed status from actual model output
        if final_fp > 0.70:
            c_status = "CRITICAL"
        elif final_fp > 0.45:
            c_status = "HIGH"
        elif final_fp > 0.20:
            c_status = "WARNING"
        else:
            c_status = "OPERATIONAL"

        top_risk = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)[:5]

        scenario = {
            "id": mid,
            "name": name,
            "type": mtype,
            "location": location,
            "age_years": age,
            "currentStatus": c_status,
            "failureProbability": round(final_fp, 4),
            "topRiskFactors": [
                {"feature": f, "importance": round(float(v), 4), "direction": "increasing"}
                for f, v in top_risk
            ],
            "series": {
                "timestamps": window["timestamp"].dt.strftime("%Y-%m-%dT%H:%M").tolist(),
                "vibration":          [round(v, 4) for v in window["vibration_mm_s"].tolist()],
                "temperature":        [round(v, 4) for v in window["temperature_c"].tolist()],
                "pressure":           [round(v, 4) for v in window["pressure_bar"].tolist()],
                "current":            [round(v, 4) for v in window["current_a"].tolist()],
                "rpm":                [round(v, 2) for v in window["rpm"].tolist()],
                "acoustic":           [round(v, 4) for v in window["acoustic_db"].tolist()],
                "labels":             window["failure_within_24h"].astype(int).tolist(),
                "failureProbability": fp_list,
            },
        }
        scenarios.append(scenario)
        n_pos = int(window["failure_within_24h"].sum())
        print(f"  Exported {mid}: {name} ({len(window)} samples, {n_pos} pos, "
              f"fp={final_fp:.3f} → {c_status}  [target: {target_status}])")

    (out_dir / "demo_scenarios.json").write_text(json.dumps(scenarios))
    print(f"Exported demo_scenarios.json ({len(scenarios)} scenarios)")
    print(f"\nDone. web/public/lib/engine/ ready for TypeScript engine.")
    print(f"  LightGBM PR-AUC:  {lgb_entry.get('pr_auc', '?'):.4f}")
    print(f"  LightGBM ROC-AUC: {lgb_entry.get('roc_auc', '?'):.4f}")
    print(f"  Threshold:        {lgb_entry.get('threshold', '?'):.3f}")
    print(f"  Portable features: {len(portable_names)}")
    print(f"  Calibration knots: {len(lgb_entry.get('calibration_x', []))}")


if __name__ == "__main__":
    main()
