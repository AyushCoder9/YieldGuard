"""Feature engineering pipeline — 250+ statistical, lag, and frequency-domain features."""
from __future__ import annotations

import logging
import warnings
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import entropy
from sklearn.base import BaseEstimator, TransformerMixin

from yieldguard.utils.io import load_config, load_parquet, save_joblib, save_parquet

logger = logging.getLogger(__name__)

SENSOR_COLS = [
    "vibration_mm_s",
    "temperature_c",
    "pressure_bar",
    "current_a",
    "rpm",
    "acoustic_db",
]
_PASSTHROUGH = {"machine_id", "timestamp", "failure_within_24h"}


class FeatureEngineer(BaseEstimator, TransformerMixin):
    """
    Computes 250+ features per sensor channel.

    Serialized alongside the model artifact (joblib) to guarantee
    identical transformations between training and inference.

    ALL temporal operations run per machine (loop over machine_id groups)
    to prevent cross-machine boundary contamination.
    """

    def __init__(
        self,
        rolling_windows: list[int] | None = None,
        ewma_spans: list[int] | None = None,
        lag_windows: list[int] | None = None,
        fft_window: int = 144,
        fft_subsample_every: int = 6,
    ) -> None:
        self.rolling_windows = rolling_windows or [6, 12, 36, 144]
        self.ewma_spans = ewma_spans or [12, 72]
        self.lag_windows = lag_windows or [6, 12, 36, 144]
        self.fft_window = fft_window
        self.fft_subsample_every = fft_subsample_every

    def fit(self, X: pd.DataFrame, y=None) -> "FeatureEngineer":
        self.feature_names_out_: list[str] = []
        self.reference_stats_: dict = {}

        # Fit on first machine only (fast, representative)
        first_mid = X["machine_id"].iloc[0]
        sample = self._transform_one_machine(X[X["machine_id"] == first_mid].head(500))

        feat_cols = [c for c in sample.columns if c not in _PASSTHROUGH]
        self.feature_names_out_ = feat_cols

        for col in feat_cols:
            vals = sample[col].dropna()
            if len(vals) > 0:
                self.reference_stats_[col] = {
                    "mean": float(vals.mean()),
                    "std": float(vals.std()),
                    "sample": vals.tolist()[:200],
                    "bins": list(np.percentile(vals, np.linspace(0, 100, 11)).tolist()),
                    "pcts": list(np.histogram(vals, bins=10)[0] / max(len(vals), 1)),
                }
        return self

    def transform(self, X: pd.DataFrame, y=None) -> pd.DataFrame:
        logger.info("Engineering features on %d rows across %d machines...",
                    len(X), X["machine_id"].nunique())

        frames = []
        for mid, g in X.groupby("machine_id"):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", pd.errors.PerformanceWarning)
                frames.append(self._transform_one_machine(g))

        result = pd.concat(frames, ignore_index=True)

        check_cols = self._get_minimal_check_cols(result)
        before = len(result)
        if check_cols:
            result = result.dropna(subset=check_cols)
        logger.info("After dropna: %d → %d rows (%.1f%% kept)",
                    before, len(result), 100 * len(result) / max(before, 1))

        if "failure_within_24h" in result.columns:
            pos_rate = result["failure_within_24h"].mean()
            assert pos_rate > 0.03, f"Label ratio too low after dropna: {pos_rate:.3f}"

        return result.reset_index(drop=True)

    # ── Per-machine transformation ────────────────────────────────────────────

    def _transform_one_machine(self, g: pd.DataFrame) -> pd.DataFrame:
        """Build all features for one machine, then concat once (no fragmentation)."""
        g = g.sort_values("timestamp").reset_index(drop=True)

        # Collect all new columns in a dict — single pd.concat at end
        new_cols: dict[str, np.ndarray | pd.Series] = {}

        for col in SENSOR_COLS:
            s = g[col]
            new_cols.update(self._rolling_stats(col, s))
            new_cols.update(self._ewma(col, s))
            new_cols.update(self._lags(col, s))
            new_cols.update(self._roc(col, s))
            new_cols.update(self._fft(col, s))

        new_cols.update(self._cross_channel(g))

        new_df = pd.DataFrame(new_cols, index=g.index)
        return pd.concat([g, new_df], axis=1)

    # ── Feature groups (return dicts) ─────────────────────────────────────────

    def _rolling_stats(self, col: str, s: pd.Series) -> dict:
        out = {}
        for w in self.rolling_windows:
            r = s.rolling(w, min_periods=max(1, w // 2))
            out[f"{col}_roll{w}_mean"] = r.mean()
            out[f"{col}_roll{w}_std"] = r.std()
            out[f"{col}_roll{w}_range"] = r.max() - r.min()
            out[f"{col}_roll{w}_skew"] = r.skew()
            out[f"{col}_roll{w}_kurt"] = r.kurt()
        return out

    def _ewma(self, col: str, s: pd.Series) -> dict:
        out = {}
        for span in self.ewma_spans:
            ema = s.ewm(span=span, adjust=False).mean()
            out[f"{col}_ema{span}"] = ema
            out[f"{col}_ema{span}_dev"] = s - ema
        return out

    def _lags(self, col: str, s: pd.Series) -> dict:
        out = {}
        for lag in self.lag_windows:
            out[f"{col}_lag{lag}"] = s.shift(lag)
            out[f"{col}_diff{lag}"] = s - s.shift(lag)
            pct = s.pct_change(lag).clip(-10, 10).replace([np.inf, -np.inf], np.nan)
            out[f"{col}_pct{lag}"] = pct
        return out

    def _roc(self, col: str, s: pd.Series) -> dict:
        roc = s.diff()
        return {
            f"{col}_roc": roc,
            f"{col}_roc_smooth": roc.rolling(6, min_periods=1).mean(),
        }

    def _fft(self, col: str, s: pd.Series) -> dict:
        """Subsampled rolling FFT → forward-filled. Avoids per-row Python loop."""
        vals = s.values
        n = len(vals)
        w = self.fft_window
        step = self.fft_subsample_every

        energy = np.full(n, np.nan)
        dom_hz = np.full(n, np.nan)
        spec_ent = np.full(n, np.nan)
        freqs_template = np.fft.rfftfreq(w, d=600.0)

        for i in range(0, n, step):
            start = max(0, i - w)
            seg = vals[start: i + 1]
            if len(seg) < 8:
                continue
            if len(seg) < w:
                seg = np.pad(seg, (w - len(seg), 0), mode="edge")
            power = np.abs(np.fft.rfft(seg)) ** 2
            energy[i] = power.sum()
            dom_hz[i] = float(freqs_template[np.argmax(power[1:]) + 1]) if len(power) > 1 else 0.0
            spec_ent[i] = float(entropy(power / (power.sum() + 1e-10)))

        ffdf = pd.DataFrame({"e": energy, "d": dom_hz, "s": spec_ent}).ffill().bfill()
        return {
            f"{col}_fft_energy": ffdf["e"].values,
            f"{col}_fft_dom_hz": ffdf["d"].values,
            f"{col}_fft_entropy": ffdf["s"].values,
        }

    def _cross_channel(self, g: pd.DataFrame) -> dict:
        return {
            "feat_vibration_x_temp": g["vibration_mm_s"] * g["temperature_c"],
            "feat_current_over_rpm": g["current_a"] / g["rpm"].clip(lower=1.0),
            "feat_power_proxy": g["current_a"] * g["vibration_mm_s"],
            "feat_pressure_temp_ratio": g["pressure_bar"] / g["temperature_c"].clip(lower=1.0),
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _get_minimal_check_cols(self, df: pd.DataFrame) -> list[str]:
        return [c for c in df.columns if "roll144" in c and "mean" in c][:3]

    def get_feature_names_out(self) -> list[str]:
        return self.feature_names_out_

    def get_portable_feature_names(self) -> list[str]:
        """Return features that are safely implementable in TypeScript.

        Excludes skew/kurt (hard to match exactly cross-platform) and fft_dom_hz
        (low importance, tricky to port). Everything else maps 1:1 to the TS engine.
        """
        portable: list[str] = []
        for name in self.feature_names_out_:
            # Rolling: mean/std/range only (skip skew/kurt)
            if any(f"_roll{w}_" in name for w in self.rolling_windows):
                if any(name.endswith(s) for s in ("_mean", "_std", "_range")):
                    portable.append(name)
                continue
            # EWMA and deviation
            if any(f"_ema{s}" in name for s in self.ewma_spans):
                portable.append(name)
                continue
            # Lag, diff, pct
            if any(f"_lag{lg}" in name or f"_diff{lg}" in name or f"_pct{lg}" in name
                   for lg in self.lag_windows):
                portable.append(name)
                continue
            # Rate of change
            if name.endswith("_roc") or name.endswith("_roc_smooth"):
                portable.append(name)
                continue
            # FFT — energy and entropy only (skip dom_hz)
            if name.endswith("_fft_energy") or name.endswith("_fft_entropy"):
                portable.append(name)
                continue
            # Cross-channel features
            if name.startswith("feat_"):
                portable.append(name)
                continue
        return portable


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cfg = load_config()

    clean_path = Path(cfg["paths"]["processed_data"]) / "clean_data.parquet"
    df = load_parquet(clean_path)

    eng = FeatureEngineer(
        rolling_windows=cfg["features"]["rolling_windows"],
        ewma_spans=cfg["features"]["ewma_spans"],
        lag_windows=cfg["features"]["lag_windows"],
        fft_window=cfg["features"]["fft_window"],
        fft_subsample_every=cfg["features"]["fft_subsample_every"],
    )

    # Pass full df (including label) — engineer passes it through unchanged
    df_feat = eng.fit_transform(df)

    out_path = Path(cfg["paths"]["processed_data"]) / "features.parquet"
    save_parquet(df_feat, out_path)
    logger.info("Saved %d features × %d rows to %s",
                len(eng.feature_names_out_), len(df_feat), out_path)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    eng_path = Path(cfg["paths"]["models"]) / f"feature_engineer_{ts}.joblib"
    save_joblib(eng, eng_path)
    logger.info("Saved FeatureEngineer to %s", eng_path)


if __name__ == "__main__":
    main()
