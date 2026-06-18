"""Synthetic PLC sensor data generator."""
from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import pandas as pd

from yieldguard.utils.io import load_config, save_parquet

logger = logging.getLogger(__name__)

SENSOR_COLS = [
    "vibration_mm_s",
    "temperature_c",
    "pressure_bar",
    "current_a",
    "rpm",
    "acoustic_db",
]


class SyntheticDataGenerator:
    """
    Generates physically plausible PLC sensor streams with:
    - Diurnal seasonal patterns
    - Exponential degradation ramps before failures
    - Random transient spikes (false alarms)
    - Heteroscedastic Gaussian noise
    - Intentional data quality issues for cleaning demos
    """

    def __init__(self, config: dict) -> None:
        self.cfg = config
        self.data_cfg = config["data"]
        self.sensor_cfg = config["sensors"]
        self.rng = np.random.default_rng(config["random_seed"])

    # ── Public ────────────────────────────────────────────────────────────────

    def generate(self) -> pd.DataFrame:
        n_machines = self.data_cfg["n_machines"]
        logger.info("Generating data for %d machines...", n_machines)
        frames = [self._generate_machine(f"M-{i:03d}") for i in range(1, n_machines + 1)]
        df = pd.concat(frames, ignore_index=True)
        logger.info("Generated %d rows, %.1f%% positive", len(df), df["failure_within_24h"].mean() * 100)
        return df

    # ── Machine-level ─────────────────────────────────────────────────────────

    def _generate_machine(self, machine_id: str) -> pd.DataFrame:
        n_rows = self.data_cfg["duration_days"] * 24 * 6  # 10-min intervals
        t = np.arange(n_rows)

        failure_times = self._sample_failure_times(n_rows)
        labels = self._compute_labels(t, failure_times)

        records: dict[str, np.ndarray] = {}
        for col in SENSOR_COLS:
            scfg = self.sensor_cfg[col]
            signal = self._build_signal(t, scfg, failure_times, n_rows)
            records[col] = signal

        df = pd.DataFrame(records)
        df["machine_id"] = machine_id
        df["timestamp"] = pd.date_range(
            start="2024-01-01", periods=n_rows, freq="10min"
        )
        df["failure_within_24h"] = labels

        df = self._inject_quality_issues(df)
        return df

    # ── Signal components ─────────────────────────────────────────────────────

    def _build_signal(
        self,
        t: np.ndarray,
        scfg: dict,
        failure_times: list[int],
        n_rows: int,
    ) -> np.ndarray:
        mu = scfg["baseline_mean"]
        sigma = scfg["baseline_std"]

        # Seasonal: 5–15% of μ, not σ (makes shift pattern visible)
        amp = self.rng.uniform(0.05, 0.15) * mu
        phase = self.rng.uniform(0, 2 * np.pi)
        seasonal = amp * np.sin(2 * np.pi * t / 144 + phase)

        # Degradation: sum contributions from all failure events
        degradation = np.zeros(n_rows)
        for t_fail in failure_times:
            degradation += self._degradation_ramp(t, t_fail, scfg)

        # Transient spikes (P=0.002, NOT correlated with failure)
        spikes = np.zeros(n_rows)
        spike_mask = self.rng.random(n_rows) < 0.002
        spike_signs = self.rng.choice([-1, 1], size=spike_mask.sum())
        spike_mags = self.rng.uniform(3, 8, size=spike_mask.sum()) * sigma
        spikes[spike_mask] = spike_signs * spike_mags

        # Heteroscedastic noise: variance scales with |seasonal|
        noise_scale = sigma * (1 + 0.3 * np.abs(seasonal) / (amp + 1e-8))
        noise = self.rng.normal(0, noise_scale)

        return mu + seasonal + degradation + spikes + noise

    def _degradation_ramp(
        self,
        t: np.ndarray,
        t_fail: int,
        scfg: dict,
    ) -> np.ndarray:
        """Exponential ramp in [DEGRADATION_WINDOW] samples before t_fail."""
        window = self.data_cfg["degradation_window_samples"]
        alpha = scfg["degradation_alpha"]
        direction = scfg["degradation_direction"]
        magnitude = scfg["degradation_magnitude_factor"] * scfg["baseline_std"]

        ramp = np.zeros(len(t))
        for i, ti in enumerate(t):
            ttf = t_fail - ti
            if ttf <= 0 or ttf > window:  # guard: no explosion after failure
                continue
            progress = 1.0 - ttf / window
            ramp[i] = direction * magnitude * (
                (np.exp(alpha * progress) - 1) / (np.exp(alpha) - 1)
            )
        return ramp

    # ── Failure sampling ──────────────────────────────────────────────────────

    def _sample_failure_times(self, n_rows: int) -> list[int]:
        """Sample failure times with minimum inter-failure spacing enforced."""
        n_fail = self.rng.integers(
            self.data_cfg["failures_per_machine_min"],
            self.data_cfg["failures_per_machine_max"] + 1,
        )
        min_spacing = self.data_cfg["min_inter_failure_spacing"]
        lookahead = self.data_cfg["failure_lookahead_samples"]

        # Valid range: must leave room for degradation window before and
        # 24h lookahead after (so label window fits within the series)
        lo = self.data_cfg["degradation_window_samples"]
        hi = n_rows - lookahead - 1

        failures: list[int] = []
        max_attempts = 10_000
        attempts = 0
        while len(failures) < n_fail and attempts < max_attempts:
            candidate = int(self.rng.integers(lo, hi))
            if all(abs(candidate - f) >= min_spacing for f in failures):
                failures.append(candidate)
            attempts += 1

        return sorted(failures)

    # ── Labeling ──────────────────────────────────────────────────────────────

    def _compute_labels(self, t: np.ndarray, failure_times: list[int]) -> np.ndarray:
        """1 if any failure within next 24h (144 samples), else 0."""
        lookahead = self.data_cfg["failure_lookahead_samples"]
        labels = np.zeros(len(t), dtype=np.int8)
        for t_fail in failure_times:
            start = max(0, t_fail - lookahead)
            labels[start:t_fail] = 1
        return labels

    # ── Data quality issues ───────────────────────────────────────────────────

    def _inject_quality_issues(self, df: pd.DataFrame) -> pd.DataFrame:
        n = len(df)

        for col in SENSOR_COLS:
            # MCAR missing values (2–5%)
            missing_rate = self.rng.uniform(0.02, 0.05)
            missing_idx = self.rng.choice(n, size=int(n * missing_rate), replace=False)
            df.loc[missing_idx, col] = np.nan

            # Stuck sensor windows (3–8 per machine, 30–60 min = 3–6 samples)
            n_stuck = int(self.rng.integers(3, 9))
            for _ in range(n_stuck):
                start = int(self.rng.integers(0, n - 6))
                length = int(self.rng.integers(3, 7))
                stuck_val = df[col].iloc[start]
                df.loc[start : start + length, col] = stuck_val

        # Out-of-range values (~0.5%)
        n_outliers = max(1, int(n * 0.005))
        for col in SENSOR_COLS[:3]:  # only first 3 channels for variety
            idx = self.rng.choice(n, size=n_outliers // 3, replace=False)
            df.loc[idx, col] = -self.rng.uniform(0.1, 2.0, size=len(idx))

        # Duplicate timestamps (~0.1%)
        n_dupes = max(1, int(n * 0.001))
        dupe_idx = self.rng.choice(n, size=n_dupes, replace=False)
        df = pd.concat([df, df.iloc[dupe_idx]], ignore_index=True)

        return df


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cfg = load_config()

    gen = SyntheticDataGenerator(cfg)
    df = gen.generate()

    out_dir = Path(cfg["paths"]["raw_data"])
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "sensor_data.parquet"
    save_parquet(df, out_path)
    logger.info("Saved %d rows to %s", len(df), out_path)


if __name__ == "__main__":
    main()
