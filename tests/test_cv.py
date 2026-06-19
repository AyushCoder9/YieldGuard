"""Unit tests for TimeSeriesExpandingCV."""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from yieldguard.utils.cv import TimeSeriesExpandingCV


def _make_cv(n_splits=3, gap=10, min_train=50, val=50):
    """Helper: create CV with small val_size for unit-test sized datasets."""
    return TimeSeriesExpandingCV(
        n_splits=n_splits,
        gap_samples=gap,
        min_train_size=min_train,
        val_size=val,
    )


class TestTimeSeriesExpandingCV:
    def test_split_count(self):
        cv = _make_cv(n_splits=4, gap=10, min_train=50, val=50)
        X = pd.DataFrame({"a": range(500)})
        y = pd.Series([0] * 500)
        splits = list(cv.split(X, y))
        assert len(splits) == 4

    def test_no_overlap_between_train_and_val(self):
        cv = _make_cv(n_splits=3, gap=20, min_train=50, val=50)
        X = pd.DataFrame({"a": range(500)})
        y = pd.Series([0] * 500)
        for train_idx, val_idx in cv.split(X, y):
            assert max(train_idx) < min(val_idx), "Train/val overlap detected"

    def test_gap_enforced(self):
        gap = 24
        cv = _make_cv(n_splits=3, gap=gap, min_train=50, val=50)
        X = pd.DataFrame({"a": range(500)})
        y = pd.Series([0] * 500)
        for train_idx, val_idx in cv.split(X, y):
            gap_actual = min(val_idx) - max(train_idx) - 1
            assert gap_actual >= gap, f"Gap {gap_actual} < {gap}"

    def test_train_grows_monotonically(self):
        cv = _make_cv(n_splits=4, gap=10, min_train=30, val=50)
        X = pd.DataFrame({"a": range(500)})
        y = pd.Series([0] * 500)
        train_sizes = [len(tr) for tr, _ in cv.split(X, y)]
        for i in range(1, len(train_sizes)):
            assert train_sizes[i] >= train_sizes[i - 1], "Train set shrank"

    def test_all_indices_covered(self):
        cv = _make_cv(n_splits=3, gap=5, min_train=30, val=50)
        n = 500
        X = pd.DataFrame({"a": range(n)})
        y = pd.Series([0] * n)
        seen_val = set()
        for _, val_idx in cv.split(X, y):
            seen_val.update(val_idx)
        assert len(seen_val) > 0

    def test_min_train_size_respected(self):
        min_size = 100
        cv = _make_cv(n_splits=3, gap=10, min_train=min_size, val=50)
        X = pd.DataFrame({"a": range(600)})
        y = pd.Series([0] * 600)
        for train_idx, _ in cv.split(X, y):
            assert len(train_idx) >= min_size

    def test_raises_on_too_small_dataset(self):
        cv = TimeSeriesExpandingCV(n_splits=3, gap_samples=144, min_train_size=50_000)
        X = pd.DataFrame({"a": range(100)})
        y = pd.Series([0] * 100)
        with pytest.raises(ValueError, match="too small"):
            list(cv.split(X, y))
