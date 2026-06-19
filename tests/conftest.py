"""Shared fixtures for YieldGuard test suite."""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from yieldguard.utils.io import load_config


@pytest.fixture(scope="session")
def cfg():
    return load_config()


@pytest.fixture(scope="session")
def small_cfg(cfg):
    """Config trimmed to 3 machines × 10 days for fast unit tests."""
    import copy
    c = copy.deepcopy(cfg)
    c["data"]["n_machines"] = 3
    c["data"]["duration_days"] = 10
    c["data"]["failures_per_machine_min"] = 1
    c["data"]["failures_per_machine_max"] = 2
    return c


@pytest.fixture(scope="session")
def raw_df(small_cfg):
    from yieldguard.data.synthesizer import SyntheticDataGenerator
    gen = SyntheticDataGenerator(small_cfg)
    return gen.generate()


@pytest.fixture(scope="session")
def processed_df(raw_df, small_cfg):
    from yieldguard.data.preprocessor import DataPreprocessor
    proc = DataPreprocessor(small_cfg)
    return proc.fit_transform(raw_df)


@pytest.fixture(scope="session")
def feature_df(processed_df, small_cfg):
    from yieldguard.features.engineer import FeatureEngineer
    fe = FeatureEngineer(
        rolling_windows=small_cfg["features"]["rolling_windows"],
        ewma_spans=small_cfg["features"]["ewma_spans"],
        lag_windows=small_cfg["features"]["lag_windows"],
        fft_window=small_cfg["features"]["fft_window"],
    )
    fe.fit(processed_df)
    return fe.transform(processed_df), fe
