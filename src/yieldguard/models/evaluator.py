"""Model evaluation — metrics, plots, SHAP, calibration."""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
)

logger = logging.getLogger(__name__)


class ModelEvaluator:
    """Generates evaluation artifacts (JSON + PNGs) from a trained model."""

    def __init__(self, output_dir: str | Path = "models/eval") -> None:
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def evaluate(
        self,
        model: Any,
        X_val: np.ndarray | pd.DataFrame,
        y_val: np.ndarray,
        feature_names: list[str],
        model_name: str,
        threshold: float = 0.5,
    ) -> dict[str, Any]:
        if isinstance(X_val, pd.DataFrame):
            X_val = X_val.values

        probs = model.predict_proba(X_val)[:, 1]
        preds = (probs >= threshold).astype(int)

        # Core metrics
        pr_auc = average_precision_score(y_val, probs)
        roc_auc = roc_auc_score(y_val, probs)
        cm = confusion_matrix(y_val, preds)
        tn, fp, fn, tp = cm.ravel()

        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 1e-10)

        # Curves
        prec_curve, rec_curve, pr_thresholds = precision_recall_curve(y_val, probs)
        fpr_curve, tpr_curve, roc_thresholds = roc_curve(y_val, probs)
        frac_pos, mean_pred = calibration_curve(y_val, probs, n_bins=10)

        # Feature importance
        fi = self._get_feature_importance(model, feature_names)

        # SHAP (top 500 rows for speed)
        shap_values = self._compute_shap(model, X_val[:500], feature_names)

        result = {
            "model_name": model_name,
            "threshold": threshold,
            "metrics": {
                "pr_auc": round(pr_auc, 4),
                "roc_auc": round(roc_auc, 4),
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
                "tp": int(tp), "fp": int(fp),
                "tn": int(tn), "fn": int(fn),
            },
            "curves": {
                "pr": {
                    "precision": prec_curve[:500].tolist(),
                    "recall": rec_curve[:500].tolist(),
                },
                "roc": {
                    "fpr": fpr_curve[:500].tolist(),
                    "tpr": tpr_curve[:500].tolist(),
                },
                "calibration": {
                    "fraction_positive": frac_pos.tolist(),
                    "mean_predicted": mean_pred.tolist(),
                },
            },
            "feature_importance": fi,
            "shap_summary": shap_values,
        }

        out_path = self.output_dir / f"{model_name}_eval.json"
        with open(out_path, "w") as f:
            json.dump(result, f, indent=2)
        logger.info("Evaluation saved → %s  PR-AUC: %.4f  ROC-AUC: %.4f",
                    out_path, pr_auc, roc_auc)
        return result

    def _get_feature_importance(
        self, model: Any, feature_names: list[str]
    ) -> list[dict]:
        try:
            if hasattr(model, "get_booster"):  # XGBoost
                raw = model.get_booster().get_fscore()
                total = sum(raw.values()) + 1e-10
                scores = {k: v / total for k, v in raw.items()}
            else:  # LightGBM
                raw = model.feature_importances_
                total = raw.sum() + 1e-10
                scores = {f: float(v / total) for f, v in zip(feature_names, raw)}

            return [
                {"feature": k, "importance": round(v, 6)}
                for k, v in sorted(scores.items(), key=lambda x: x[1], reverse=True)
            ][:30]
        except Exception as e:
            logger.warning("Feature importance failed: %s", e)
            return []

    def _compute_shap(
        self, model: Any, X: np.ndarray, feature_names: list[str]
    ) -> list[dict]:
        try:
            import shap
            explainer = shap.TreeExplainer(model)
            shap_vals = explainer.shap_values(X)
            if isinstance(shap_vals, list):
                shap_vals = shap_vals[1]
            mean_abs = np.abs(shap_vals).mean(axis=0)
            total = mean_abs.sum() + 1e-10
            return [
                {"feature": f, "shap_importance": round(float(v / total), 6)}
                for f, v in sorted(
                    zip(feature_names, mean_abs),
                    key=lambda x: x[1], reverse=True
                )
            ][:20]
        except Exception as e:
            logger.warning("SHAP computation failed: %s", e)
            return []
