"""Unit tests for DataPreprocessor."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from yieldguard.data.preprocessor import SENSOR_COLS, DataPreprocessor


class TestDataPreprocessor:
    def test_output_has_all_sensor_cols(self, processed_df):
        for col in SENSOR_COLS:
            assert col in processed_df.columns

    def test_no_duplicate_timestamps_per_machine(self, processed_df):
        dups = processed_df.duplicated(subset=["machine_id", "timestamp"])
        assert not dups.any(), "Duplicate (machine_id, timestamp) pairs remain"

    def test_out_of_range_values_clipped(self, processed_df, small_cfg):
        for col in SENSOR_COLS:
            lo, hi = small_cfg["sensors"][col]["bounds"]
            col_clean = processed_df[col].dropna()
            assert (col_clean >= lo).all(), f"{col}: values below lower bound"
            assert (col_clean <= hi).all(), f"{col}: values above upper bound"

    def test_missing_rate_below_threshold(self, processed_df):
        for col in SENSOR_COLS:
            rate = processed_df[col].isna().mean()
            assert rate < 0.05, f"{col}: missing rate {rate:.1%} too high after imputation"

    def test_machine_count_preserved(self, raw_df, processed_df):
        assert processed_df["machine_id"].nunique() == raw_df["machine_id"].nunique()

    def test_labels_preserved(self, processed_df):
        assert "failure_within_24h" in processed_df.columns
        vals = processed_df["failure_within_24h"].dropna().unique()
        assert set(vals).issubset({0, 1, 0.0, 1.0})

    def test_positive_rate_not_destroyed(self, processed_df):
        rate = processed_df["failure_within_24h"].mean()
        assert rate > 0.01, f"Preprocessing destroyed most labels: rate={rate:.4f}"

    def test_timestamps_are_datetime(self, processed_df):
        assert pd.api.types.is_datetime64_any_dtype(processed_df["timestamp"])

    def test_no_inf_values(self, processed_df):
        num = processed_df[SENSOR_COLS].select_dtypes(include="number")
        assert not np.isinf(num.values).any(), "Inf values found after preprocessing"
