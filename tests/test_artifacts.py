"""Integration tests — verify exported engine artifacts are consistent."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pytest


ENGINE_DIR = Path(__file__).parent.parent / "web" / "public" / "lib" / "engine"


@pytest.fixture(scope="module")
def model_json():
    path = ENGINE_DIR / "model.json"
    assert path.exists(), "model.json not found — run scripts/export_model.py first"
    return json.loads(path.read_text())


@pytest.fixture(scope="module")
def feature_spec():
    path = ENGINE_DIR / "feature_spec.json"
    assert path.exists(), "feature_spec.json not found — run scripts/export_model.py first"
    return json.loads(path.read_text())


@pytest.fixture(scope="module")
def demo_scenarios():
    path = ENGINE_DIR / "demo_scenarios.json"
    assert path.exists(), "demo_scenarios.json not found — run scripts/export_model.py first"
    return json.loads(path.read_text())


class TestModelJson:
    def test_has_tree_info(self, model_json):
        assert "tree_info" in model_json
        assert len(model_json["tree_info"]) > 0

    def test_pr_auc_believable(self, model_json):
        pr_auc = model_json.get("pr_auc", 0)
        assert 0.70 < pr_auc < 0.98, f"PR-AUC {pr_auc:.4f} outside believable range"

    def test_roc_auc_believable(self, model_json):
        roc_auc = model_json.get("roc_auc", 0)
        assert 0.85 < roc_auc < 0.99, f"ROC-AUC {roc_auc:.4f} outside believable range"

    def test_threshold_reasonable(self, model_json):
        t = model_json.get("threshold", 0)
        assert 0.3 < t < 0.9, f"Threshold {t} unreasonable"

    def test_calibration_knots_present(self, model_json):
        cx = model_json.get("calibration_x", [])
        cy = model_json.get("calibration_y", [])
        assert len(cx) > 0, "calibration_x empty — isotonic calibration not exported"
        assert len(cx) == len(cy), "calibration_x/y length mismatch"

    def test_calibration_x_monotone(self, model_json):
        cx = model_json.get("calibration_x", [])
        if cx:
            assert np.all(np.diff(cx) >= 0), "calibration_x not monotonically increasing"

    def test_calibration_y_in_unit_interval(self, model_json):
        cy = model_json.get("calibration_y", [])
        if cy:
            assert all(0.0 <= v <= 1.0 for v in cy), "calibration_y values outside [0,1]"

    def test_tree_structure_has_required_fields(self, model_json):
        tree = model_json["tree_info"][0]
        assert "tree_structure" in tree


class TestFeatureSpec:
    def test_feature_names_list(self, feature_spec):
        names = feature_spec.get("feature_names", [])
        assert len(names) > 50, f"Too few portable features: {len(names)}"

    def test_sensor_cols_present(self, feature_spec):
        cols = feature_spec.get("sensor_cols", [])
        expected = {"vibration_mm_s", "temperature_c", "pressure_bar", "current_a", "rpm", "acoustic_db"}
        assert set(cols) == expected

    def test_sensor_baselines_complete(self, feature_spec):
        baselines = feature_spec.get("sensor_baselines", {})
        assert len(baselines) == 6
        for col, b in baselines.items():
            assert "mean" in b and "std" in b and "bounds" in b

    def test_feature_metadata_has_mean_std_importance(self, feature_spec):
        features = feature_spec.get("features", {})
        assert len(features) > 0
        sample = next(iter(features.values()))
        assert "mean" in sample and "std" in sample and "importance" in sample

    def test_importances_sum_positive(self, feature_spec):
        features = feature_spec.get("features", {})
        total = sum(v["importance"] for v in features.values())
        assert total > 0, "All importances are zero — position mapping failed"

    def test_rolling_windows_match_config(self, feature_spec, cfg):
        assert feature_spec["rolling_windows"] == cfg["features"]["rolling_windows"]


class TestDemoScenarios:
    def test_five_scenarios(self, demo_scenarios):
        assert len(demo_scenarios) == 5

    def test_required_top_level_fields(self, demo_scenarios):
        required = {"id", "name", "type", "location", "age_years",
                    "currentStatus", "failureProbability", "topRiskFactors", "series"}
        for s in demo_scenarios:
            missing = required - set(s.keys())
            assert not missing, f"{s['id']}: missing fields {missing}"

    def test_failure_probability_in_unit_interval(self, demo_scenarios):
        for s in demo_scenarios:
            fp = s["failureProbability"]
            assert 0.0 <= fp <= 1.0, f"{s['id']}: failureProbability {fp} out of [0,1]"

    def test_current_status_valid(self, demo_scenarios):
        valid = {"OPERATIONAL", "WARNING", "HIGH", "CRITICAL"}
        for s in demo_scenarios:
            assert s["currentStatus"] in valid, f"{s['id']}: unknown status {s['currentStatus']}"

    def test_scenario_diversity(self, demo_scenarios):
        statuses = {s["currentStatus"] for s in demo_scenarios}
        assert len(statuses) >= 2, f"All scenarios have same status: {statuses}"

    def test_series_lengths_consistent(self, demo_scenarios):
        for s in demo_scenarios:
            series = s["series"]
            lengths = {k: len(v) for k, v in series.items()}
            unique_lens = set(lengths.values())
            assert len(unique_lens) == 1, f"{s['id']}: inconsistent series lengths {lengths}"

    def test_failure_probability_series_in_unit_interval(self, demo_scenarios):
        for s in demo_scenarios:
            fp_series = s["series"]["failureProbability"]
            bad = [v for v in fp_series if not (0.0 <= v <= 1.0)]
            assert not bad, f"{s['id']}: out-of-range fp values: {bad[:5]}"

    def test_top_risk_factors_populated(self, demo_scenarios):
        for s in demo_scenarios:
            assert len(s["topRiskFactors"]) > 0, f"{s['id']}: no top risk factors"

    def test_at_least_one_critical_or_high(self, demo_scenarios):
        high_risk = [s for s in demo_scenarios if s["currentStatus"] in {"HIGH", "CRITICAL"}]
        assert len(high_risk) >= 1, "No high-risk machines in demo scenarios"

    def test_at_least_one_operational(self, demo_scenarios):
        healthy = [s for s in demo_scenarios if s["currentStatus"] == "OPERATIONAL"]
        assert len(healthy) >= 1, "No healthy machine in demo scenarios"
