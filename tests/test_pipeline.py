"""Integration tests — full pipeline: generate → preprocess → features."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from yieldguard.data.synthesizer import SENSOR_COLS


_PASSTHROUGH = {"machine_id", "timestamp", "failure_within_24h"}


class TestFullPipeline:
    def test_pipeline_produces_feature_dataframe(self, feature_df):
        df, fe = feature_df
        assert len(df) > 0
        assert "failure_within_24h" in df.columns

    def test_feature_count_matches_portable_spec(self, feature_df):
        df, fe = feature_df
        portable = fe.get_portable_feature_names()
        df_feat = [c for c in df.columns if c not in _PASSTHROUGH]
        # All portable features must appear in df
        assert set(portable).issubset(set(df_feat))

    def test_no_nan_in_core_features(self, feature_df):
        """Core roll6_mean features (smallest window) must be non-NaN after dropna.
        Larger windows (roll144_mean) can still have NaN for machines with imputation gaps;
        the transform dropna only removes rows missing the minimal-check columns.
        """
        df, fe = feature_df
        small_w = min(fe.rolling_windows)
        for col in SENSOR_COLS:
            core = f"{col}_roll{small_w}_mean"
            if core in df.columns:
                assert not df[core].isna().any(), f"{core} has NaN after dropna"

    def test_label_distribution_preserved_end_to_end(self, raw_df, feature_df):
        orig_rate = raw_df["failure_within_24h"].mean()
        df, fe = feature_df
        final_rate = df["failure_within_24h"].mean()
        # Dropna removes warmup rows (which are mostly 0s), so positive rate can increase
        assert final_rate > 0.03
        assert abs(final_rate - orig_rate) < 0.15, (
            f"Label rate shifted too much: {orig_rate:.3f} → {final_rate:.3f}"
        )

    def test_machine_ids_intact_end_to_end(self, raw_df, feature_df):
        df, fe = feature_df
        assert df["machine_id"].nunique() == raw_df["machine_id"].nunique()

    def test_feature_values_are_finite(self, feature_df):
        df, fe = feature_df
        feat_cols = [c for c in df.columns if c not in _PASSTHROUGH]
        for col in feat_cols:
            vals = df[col].dropna()
            assert np.isfinite(vals.values).all(), f"{col}: non-finite values"

    def test_timestamps_sorted_per_machine(self, feature_df):
        df, fe = feature_df
        for mid, g in df.groupby("machine_id"):
            ts = pd.to_datetime(g["timestamp"]).values
            assert (np.diff(ts.astype("int64")) >= 0).all(), f"{mid}: unsorted timestamps"

    def test_x_y_shapes_compatible(self, feature_df):
        df, fe = feature_df
        feat_cols = [c for c in df.columns if c not in _PASSTHROUGH]
        X = df[feat_cols].astype(np.float32)
        y = df["failure_within_24h"].astype(int)
        assert len(X) == len(y)
        assert X.shape[1] == len(feat_cols)
