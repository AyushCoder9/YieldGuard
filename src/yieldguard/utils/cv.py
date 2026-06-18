from __future__ import annotations

from typing import Iterator

import numpy as np
import pandas as pd
from sklearn.model_selection import BaseCrossValidator


class TimeSeriesExpandingCV(BaseCrossValidator):
    """
    Chronological expanding-window CV across all machines simultaneously.

    Train: [0 .. split_end]  |  gap (24h = 144 samples)  |  Val: [split_end+gap .. split_end+gap+val_size]

    All machines appear in both train and val (different time windows).
    The 144-sample gap prevents label leakage — a positive sample at the
    train tail cannot have its failure event inside the val window.
    """

    def __init__(
        self,
        n_splits: int = 5,
        gap_samples: int = 144,
        min_train_size: int = 50_000,
        val_size: int = 50_000,
    ) -> None:
        self.n_splits = n_splits
        self.gap_samples = gap_samples
        self.min_train_size = min_train_size
        self.val_size = val_size

    def split(
        self,
        X: pd.DataFrame | np.ndarray,
        y=None,
        groups=None,
    ) -> Iterator[tuple[np.ndarray, np.ndarray]]:
        n = len(X)
        total_needed = self.min_train_size + self.gap_samples + self.val_size
        if n < total_needed:
            raise ValueError(
                f"Dataset too small: need {total_needed} rows, got {n}"
            )

        usable = n - self.gap_samples - self.val_size
        step = (usable - self.min_train_size) // self.n_splits

        for i in range(self.n_splits):
            train_end = self.min_train_size + i * step
            val_start = train_end + self.gap_samples
            val_end = val_start + self.val_size
            if val_end > n:
                break
            train_idx = np.arange(0, train_end)
            val_idx = np.arange(val_start, val_end)
            yield train_idx, val_idx

    def get_n_splits(self, X=None, y=None, groups=None) -> int:
        return self.n_splits

    def _iter_test_indices(self, X=None, y=None, groups=None):
        for _, val_idx in self.split(X, y, groups):
            yield val_idx
