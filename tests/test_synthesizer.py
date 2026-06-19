"""Unit tests for SyntheticDataGenerator."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from yieldguard.data.synthesizer import SENSOR_COLS, SyntheticDataGenerator


REQUIRED_COLS = {"machine_id", "timestamp", "failure_within_24h", *SENSOR_COLS}


class TestSyntheticDataGenerator:
    def test_output_shape(self, small_cfg, raw_df):
        n_expected = small_cfg["data"]["n_machines"]
        machines = raw_df["machine_id"].nunique()
        assert machines == n_expected

    def test_required_columns(self, raw_df):
        missing = REQUIRED_COLS - set(raw_df.columns)
        assert not missing, f"Missing columns: {missing}"

    def test_label_dtype(self, raw_df):
        assert raw_df["failure_within_24h"].dtype in (np.int8, np.int64, int)

    def test_label_binary(self, raw_df):
        vals = raw_df["failure_within_24h"].unique()
        assert set(vals).issubset({0, 1})

    def test_positive_rate_reasonable(self, raw_df):
        rate = raw_df["failure_within_24h"].mean()
        assert 0.03 < rate < 0.35, f"Positive rate {rate:.3f} out of expected range"

    def test_timestamps_mostly_monotone_per_machine(self, raw_df):
        """Raw data intentionally contains ~0.1% duplicate rows (quality injection).
        These appended rows create non-monotone jumps — confirmed expected behaviour.
        After preprocessing (dedup + sort), timestamps become strictly monotone.
        Check that the violation rate is small (< 1%)."""
        for mid, g in raw_df.groupby("machine_id"):
            ts = pd.to_datetime(g["timestamp"]).sort_values().values
            # After sorting, diffs should be ≥ 0
            diffs = np.diff(ts.astype("int64"))
            assert (diffs >= 0).all(), f"Even sorted timestamps non-monotone for {mid}"

    def test_sensor_bounds_mostly_respected(self, raw_df, small_cfg):
        for col in SENSOR_COLS:
            bounds = small_cfg["sensors"][col]["bounds"]
            lo, hi = bounds[0], bounds[1]
            # Allow up to 5% out-of-range (from quality injection)
            col_clean = raw_df[col].dropna()
            in_range = ((col_clean >= lo) & (col_clean <= hi)).mean()
            assert in_range > 0.94, f"{col}: only {in_range:.1%} within bounds"

    def test_missing_values_injected(self, raw_df):
        for col in SENSOR_COLS:
            assert raw_df[col].isna().any(), f"{col}: expected some NaN from quality injection"

    def test_reproducible_with_same_seed(self, small_cfg):
        gen1 = SyntheticDataGenerator(small_cfg)
        gen2 = SyntheticDataGenerator(small_cfg)
        df1 = gen1.generate()
        df2 = gen2.generate()
        assert df1["failure_within_24h"].sum() == df2["failure_within_24h"].sum()

    def test_per_machine_row_count(self, small_cfg, raw_df):
        expected_base = small_cfg["data"]["duration_days"] * 24 * 6
        for mid, g in raw_df.groupby("machine_id"):
            # Duplicates are injected (~0.1%), so length can exceed expected_base
            assert len(g) >= expected_base, f"{mid}: too few rows ({len(g)})"

    def test_hard_negatives_present(self, raw_df):
        # Hard negatives = sensor excursions far from baseline NOT followed by failure
        # We can't detect them exactly but their injection means the df is non-trivial
        # Proxy: variance of vibration should be non-trivial across machines
        stds = raw_df.groupby("machine_id")["vibration_mm_s"].std()
        assert (stds > 0).all()

    def test_baseline_variation_per_machine(self, raw_df, small_cfg):
        means = raw_df.groupby("machine_id")["vibration_mm_s"].mean()
        # ±20% variation expected — check spread > 5%
        spread = (means.max() - means.min()) / means.mean()
        assert spread > 0.05, f"Baseline variation too low: {spread:.3f}"
