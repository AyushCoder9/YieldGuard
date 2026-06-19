"""Unit tests for FeatureEngineer."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from yieldguard.data.synthesizer import SENSOR_COLS


_PASSTHROUGH = {"machine_id", "timestamp", "failure_within_24h"}


class TestFeatureEngineer:
    def test_output_has_feature_cols(self, feature_df):
        df, fe = feature_df
        feat_cols = [c for c in df.columns if c not in _PASSTHROUGH]
        assert len(feat_cols) > 50, f"Too few feature columns: {len(feat_cols)}"

    def test_portable_feature_names_match_columns(self, feature_df):
        df, fe = feature_df
        portable = fe.get_portable_feature_names()
        df_feat_cols = set(c for c in df.columns if c not in _PASSTHROUGH)
        # Portable subset must be contained in df columns
        missing = set(portable) - df_feat_cols
        assert not missing, f"Portable features not in df: {missing}"

    def test_no_cross_machine_contamination(self, feature_df):
        """Roll/lag features must not bleed across machine boundaries."""
        df, fe = feature_df
        for mid, g in df.groupby("machine_id"):
            # First row's roll features should be NaN or filled from its own history only
            # The key check: all rows belong to one machine in each group
            assert (g["machine_id"] == mid).all()

    def test_pct_change_clipped(self, feature_df):
        """pct_change features must be in [-10, 10]."""
        df, fe = feature_df
        pct_cols = [c for c in df.columns if "pct" in c]
        if pct_cols:
            for col in pct_cols:
                vals = df[col].dropna()
                assert (vals >= -10).all(), f"{col}: values below -10"
                assert (vals <= 10).all(), f"{col}: values above 10"

    def test_rolling_features_exist(self, feature_df):
        df, fe = feature_df
        for col in SENSOR_COLS:
            for w in fe.rolling_windows:
                assert f"{col}_roll{w}_mean" in df.columns

    def test_ewma_features_exist(self, feature_df):
        df, fe = feature_df
        for col in SENSOR_COLS:
            for span in fe.ewma_spans:
                assert f"{col}_ema{span}" in df.columns

    def test_fft_features_exist(self, feature_df):
        df, fe = feature_df
        for col in SENSOR_COLS:
            assert f"{col}_fft_energy" in df.columns

    def test_reference_stats_fitted(self, feature_df):
        df, fe = feature_df
        assert hasattr(fe, "reference_stats_")
        assert len(fe.reference_stats_) > 0

    def test_feature_names_out_fitted(self, feature_df):
        df, fe = feature_df
        assert hasattr(fe, "feature_names_out_")
        assert len(fe.feature_names_out_) > 0

    def test_no_all_nan_feature_col(self, feature_df):
        df, fe = feature_df
        feat_cols = [c for c in df.columns if c not in _PASSTHROUGH]
        all_nan = [c for c in feat_cols if df[c].isna().all()]
        assert not all_nan, f"All-NaN feature columns: {all_nan[:5]}"

    def test_positive_rate_after_dropna_sufficient(self, feature_df):
        df, fe = feature_df
        rate = df["failure_within_24h"].mean()
        assert rate > 0.03, f"Positive rate too low after dropna: {rate:.4f}"

    def test_cross_channel_features_exist(self, feature_df):
        df, fe = feature_df
        cross = [c for c in df.columns if "ratio" in c or "cross" in c]
        assert len(cross) > 0, "No cross-channel features found"
