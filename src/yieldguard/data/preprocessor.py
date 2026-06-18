"""Data cleaning and imputation pipeline."""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from yieldguard.utils.io import load_config, load_parquet, save_parquet

logger = logging.getLogger(__name__)

SENSOR_COLS = [
    "vibration_mm_s",
    "temperature_c",
    "pressure_bar",
    "current_a",
    "rpm",
    "acoustic_db",
]


class DataPreprocessor:
    """
    Cleans raw synthetic sensor data:
    1. Dedup timestamps per machine
    2. Resample to exact 10-min grid
    3. Clip out-of-range values → NaN
    4. Detect and nullify stuck sensor windows
    5. Impute: ffill(limit=6) → linear interpolation
    """

    def __init__(self, config: dict) -> None:
        self.cfg = config
        self.sensor_cfg = config["sensors"]

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        logger.info("Preprocessing %d raw rows...", len(df))
        df = self._dedup(df)
        df = self._clip_out_of_range(df)
        df = self._mark_stuck_sensors(df)
        df = self._resample_and_impute(df)
        df = self._validate(df)
        logger.info("Preprocessed: %d rows, %.2f%% missing remaining",
                    len(df), df[SENSOR_COLS].isna().mean().mean() * 100)
        return df

    # ── Steps ─────────────────────────────────────────────────────────────────

    def _dedup(self, df: pd.DataFrame) -> pd.DataFrame:
        before = len(df)
        df = df.drop_duplicates(subset=["machine_id", "timestamp"])
        logger.debug("Dedup: %d → %d rows", before, len(df))
        return df

    def _clip_out_of_range(self, df: pd.DataFrame) -> pd.DataFrame:
        for col in SENSOR_COLS:
            lo, hi = self.sensor_cfg[col]["bounds"]
            mask = (df[col] < lo) | (df[col] > hi)
            if mask.any():
                logger.debug("Clipping %d out-of-range values in %s", mask.sum(), col)
                df.loc[mask, col] = np.nan
        return df

    def _mark_stuck_sensors(
        self,
        df: pd.DataFrame,
        min_window: int = 3,
        var_tol: float = 1e-6,
    ) -> pd.DataFrame:
        """Replace stuck windows (rolling variance < tol for ≥ min_window rows) with NaN."""

        def _mark_col(series: pd.Series) -> pd.Series:
            rv = series.rolling(min_window, min_periods=min_window).var()
            stuck = rv < var_tol
            # Expand: if tail of window is stuck, all rows in that window are stuck
            stuck_expanded = stuck.rolling(min_window, min_periods=1).max().astype(bool)
            return series.where(~stuck_expanded)

        for col in SENSOR_COLS:
            df[col] = (
                df.groupby("machine_id", group_keys=False)[col]
                .transform(_mark_col)
            )
        return df

    def _resample_and_impute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Resample each machine to exact 10-min grid, then impute gaps."""
        frames = []
        for mid, g in df.groupby("machine_id"):
            g = g.drop(columns=["machine_id"]).set_index("timestamp").sort_index()
            g = g.resample("10min").mean(numeric_only=True)
            g[SENSOR_COLS] = (
                g[SENSOR_COLS]
                .ffill(limit=6)
                .interpolate(method="linear", limit_direction="forward", limit=6)
            )
            g["failure_within_24h"] = (
                g["failure_within_24h"].ffill().fillna(0).astype(int)
            )
            g["machine_id"] = mid
            frames.append(g.reset_index())
        return pd.concat(frames, ignore_index=True)

    def _validate(self, df: pd.DataFrame) -> pd.DataFrame:
        pos_rate = df["failure_within_24h"].mean()
        if pos_rate < 0.03:
            logger.warning("Positive class rate very low: %.2f%%", pos_rate * 100)
        return df


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cfg = load_config()

    raw_path = Path(cfg["paths"]["raw_data"]) / "sensor_data.parquet"
    df_raw = load_parquet(raw_path)

    preprocessor = DataPreprocessor(cfg)
    df_clean = preprocessor.fit_transform(df_raw)

    out_path = Path(cfg["paths"]["processed_data"]) / "clean_data.parquet"
    save_parquet(df_clean, out_path)
    logger.info("Saved clean data to %s", out_path)


if __name__ == "__main__":
    main()
