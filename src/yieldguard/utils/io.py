from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
import yaml


def load_config(path: str | Path = "configs/config.yaml") -> dict[str, Any]:
    with open(path) as f:
        return yaml.safe_load(f)


def save_parquet(df: pd.DataFrame, path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False, engine="pyarrow", compression="snappy")


def load_parquet(path: str | Path) -> pd.DataFrame:
    return pd.read_parquet(path, engine="pyarrow")


def save_joblib(obj: Any, path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(obj, path, compress=3)


def load_joblib(path: str | Path) -> Any:
    return joblib.load(path)


def load_registry(path: str | Path = "configs/model_registry.json") -> dict[str, Any]:
    with open(path) as f:
        return json.load(f)


def update_registry(
    name: str,
    metrics: dict[str, float],
    path: str | Path = "configs/model_registry.json",
) -> None:
    registry = load_registry(path)
    entry = {
        "name": name,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
    }
    registry["active"] = name
    existing = [e for e in registry["entries"] if e["name"] != name]
    registry["entries"] = existing + [entry]
    with open(path, "w") as f:
        json.dump(registry, f, indent=2)
