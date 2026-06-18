"""Per-machine stateful feature buffer — maintains 288-sample rolling history."""
from __future__ import annotations

from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Optional

import pandas as pd

from yieldguard.serving.schemas import SensorReading

_CAPACITY = 288  # 48h of 10-min readings — enough for all lag/rolling features


class PerMachineBuffer:
    """
    Maintains a rolling 288-sample history per machine_id.
    Single instance shared across FastAPI requests (app state).

    Returns None until buffer is warm (capacity reached).
    State is in-process only — lost on restart (acceptable for demo scale).
    """

    def __init__(self, capacity: int = _CAPACITY) -> None:
        self._capacity = capacity
        self._buffers: dict[str, deque] = defaultdict(
            lambda: deque(maxlen=self._capacity)
        )
        self._machine_meta: dict[str, datetime] = {}

    def push(self, machine_id: str, reading: SensorReading) -> bool:
        """Push one reading. Returns True when buffer is warm."""
        self._buffers[machine_id].append(reading)
        self._machine_meta[machine_id] = datetime.now(timezone.utc)
        return self.is_warm(machine_id)

    def is_warm(self, machine_id: str) -> bool:
        return len(self._buffers[machine_id]) >= self._capacity

    def samples_count(self, machine_id: str) -> int:
        return len(self._buffers[machine_id])

    def to_dataframe(self, machine_id: str) -> Optional[pd.DataFrame]:
        buf = self._buffers[machine_id]
        if not buf:
            return None
        rows = [r.model_dump() for r in buf]
        df = pd.DataFrame(rows)
        df["machine_id"] = machine_id
        df = df.sort_values("timestamp").reset_index(drop=True)
        return df

    def list_machines(self) -> list[dict]:
        return [
            {
                "machine_id": mid,
                "samples": len(buf),
                "warm": self.is_warm(mid),
                "last_seen": self._machine_meta.get(mid, "").isoformat()
                if mid in self._machine_meta else None,
            }
            for mid, buf in self._buffers.items()
        ]

    def clear(self, machine_id: str) -> None:
        if machine_id in self._buffers:
            self._buffers[machine_id].clear()
