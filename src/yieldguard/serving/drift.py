"""Lightweight data drift monitor using PSI and Kolmogorov-Smirnov tests."""
from __future__ import annotations

import json
import logging
from collections import deque
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from scipy.stats import ks_2samp

logger = logging.getLogger(__name__)


class DriftMonitor:
    """
    Monitors feature distribution shift between training reference and live inference.

    PSI interpretation:
        < 0.10 — stable
        0.10–0.20 — moderate drift, investigate
        > 0.20 — severe drift, consider retraining
    """

    PSI_WARNING = 0.10
    PSI_CRITICAL = 0.20
    KS_P_THRESHOLD = 0.01

    def __init__(self, reference_stats: dict[str, Any], window: int = 1000) -> None:
        self.reference = reference_stats
        self._prediction_log: deque[dict] = deque(maxlen=window)

    @classmethod
    def from_json(cls, path: str | Path) -> "DriftMonitor":
        with open(path) as f:
            stats = json.load(f)
        return cls(stats)

    def record(self, features: dict[str, float]) -> None:
        self._prediction_log.append(features)

    def check_drift(self) -> dict[str, Any]:
        if len(self._prediction_log) < 50:
            return {
                "overall_status": "no_reference_data",
                "drifted_features": [],
                "psi_scores": {},
                "message": f"Need ≥50 predictions; have {len(self._prediction_log)}",
            }

        df = pd.DataFrame(list(self._prediction_log))
        drifted = []
        psi_scores: dict[str, float] = {}

        common_features = [
            f for f in self.reference if f in df.columns
        ][:50]  # check top 50

        for feat in common_features:
            ref_info = self.reference[feat]
            actual = df[feat].dropna().values
            if len(actual) < 10:
                continue

            psi = self._compute_psi(actual, ref_info.get("bins", []),
                                     ref_info.get("pcts", []))
            psi_scores[feat] = round(psi, 4)

            ref_sample = np.array(ref_info.get("sample", []))
            if len(ref_sample) > 10:
                _, p_val = ks_2samp(actual, ref_sample)
                if p_val < self.KS_P_THRESHOLD or psi > self.PSI_WARNING:
                    drifted.append(feat)

        if not psi_scores:
            status = "no_reference_data"
        elif any(v > self.PSI_CRITICAL for v in psi_scores.values()):
            status = "CRITICAL"
        elif any(v > self.PSI_WARNING for v in psi_scores.values()):
            status = "WARNING"
        else:
            status = "OK"

        return {
            "overall_status": status,
            "drifted_features": drifted[:10],
            "psi_scores": dict(sorted(psi_scores.items(),
                                      key=lambda x: x[1], reverse=True)[:20]),
            "n_predictions_checked": len(self._prediction_log),
        }

    @staticmethod
    def _compute_psi(
        actual: np.ndarray,
        ref_bins: list[float],
        ref_pcts: list[float],
    ) -> float:
        if len(ref_bins) < 2 or len(ref_pcts) < 1:
            return 0.0
        try:
            actual_counts, _ = np.histogram(actual, bins=ref_bins)
            actual_pcts = actual_counts / (actual_counts.sum() + 1e-10) + 1e-10
            ref = np.array(ref_pcts) + 1e-10
            n = min(len(actual_pcts), len(ref))
            return float(np.sum((actual_pcts[:n] - ref[:n]) * np.log(actual_pcts[:n] / ref[:n])))
        except Exception:
            return 0.0
