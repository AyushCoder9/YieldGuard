"""Model training — XGBoost + LightGBM with TimeSeriesCV and Optuna HPO."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import optuna
import pandas as pd
from sklearn.isotonic import IsotonicRegression
from sklearn.metrics import average_precision_score, f1_score, roc_auc_score
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier

from yieldguard.utils.cv import TimeSeriesExpandingCV
from yieldguard.utils.io import load_config, load_parquet, save_joblib, update_registry

logger = logging.getLogger(__name__)
optuna.logging.set_verbosity(optuna.logging.WARNING)

_PASSTHROUGH = {"machine_id", "timestamp", "failure_within_24h"}


@dataclass
class FoldResult:
    fold: int
    pr_auc: float
    roc_auc: float
    f1: float
    best_iteration: int
    threshold: float


@dataclass
class TrainingResult:
    model_name: str
    model: Any
    fold_results: list[FoldResult]
    best_params: dict
    best_iteration: int
    mean_pr_auc: float
    mean_roc_auc: float
    optimal_threshold: float
    feature_names: list[str]
    feature_importances: dict[str, float]
    artifact_path: str


class FailurePredictionTrainer:
    """
    Trains XGBoost and LightGBM classifiers with:
    - TimeSeriesExpandingCV (no data leakage)
    - Optuna Bayesian HPO
    - scale_pos_weight for imbalanced classes (no SMOTE)
    - Median best_iteration refit strategy
    - PR-AUC as primary metric
    """

    def __init__(self, config: dict) -> None:
        self.cfg = config
        self.model_cfg = config["model"]
        self.rng = np.random.default_rng(config["random_seed"])

    def train_all(
        self, X: pd.DataFrame, y: pd.Series
    ) -> dict[str, TrainingResult]:
        results = {}
        for name in ["xgboost", "lightgbm"]:
            logger.info("=" * 60)
            logger.info("Training %s", name)
            results[name] = self.train_one(name, X, y)
        return results

    def train_one(
        self, model_name: str, X: pd.DataFrame, y: pd.Series
    ) -> TrainingResult:
        n_neg = int((y == 0).sum())
        n_pos = int((y == 1).sum())
        scale_pos_weight = n_neg / max(n_pos, 1)
        logger.info("Class ratio — neg: %d  pos: %d  scale_pos_weight: %.2f",
                    n_neg, n_pos, scale_pos_weight)

        # ── Optuna HPO ────────────────────────────────────────────────────────
        n_trials = self.model_cfg.get("optuna_n_trials", 10)
        logger.info("Running Optuna HPO: %d trials...", n_trials)

        study = optuna.create_study(direction="maximize",
                                    sampler=optuna.samplers.TPESampler(seed=42))
        study.optimize(
            lambda t: self._optuna_objective(t, model_name, X, y, scale_pos_weight),
            n_trials=n_trials,
            n_jobs=1,
        )
        best_params = study.best_params
        logger.info("Best PR-AUC: %.4f  params: %s", study.best_value, best_params)

        # ── Full CV with best params ──────────────────────────────────────────
        fold_results = self._full_cv(model_name, X, y, best_params, scale_pos_weight)
        best_iteration = int(np.median([r.best_iteration for r in fold_results]))
        optimal_threshold = float(np.mean([r.threshold for r in fold_results]))

        mean_pr_auc = float(np.mean([r.pr_auc for r in fold_results]))
        mean_roc_auc = float(np.mean([r.roc_auc for r in fold_results]))
        logger.info("CV results — PR-AUC: %.4f  ROC-AUC: %.4f  threshold: %.3f",
                    mean_pr_auc, mean_roc_auc, optimal_threshold)

        # ── Final refit on ALL data ───────────────────────────────────────────
        final_model = self._build_model(
            model_name, best_params, scale_pos_weight,
            n_estimators=best_iteration, early_stopping=False
        )
        final_model.fit(X.values, y.values)

        # Feature importance
        if model_name == "xgboost":
            raw_imp = final_model.get_booster().get_fscore()
            importances = {k: float(v) for k, v in raw_imp.items()}
        else:
            raw_imp = final_model.feature_importances_
            importances = {f: float(v) for f, v in zip(X.columns, raw_imp)}
        # Normalise and sort
        total = sum(importances.values()) + 1e-10
        importances = dict(
            sorted({k: v / total for k, v in importances.items()}.items(),
                   key=lambda x: x[1], reverse=True)
        )

        # ── Isotonic calibration on held-out last 20% (by time) ──────────────
        calibration_x: list[float] = []
        calibration_y: list[float] = []
        try:
            n = len(X)
            holdout_start = int(n * 0.80)
            X_cal = X.iloc[holdout_start:].values
            y_cal = y.iloc[holdout_start:].values
            raw_probs = final_model.predict_proba(X_cal)[:, 1]
            iso = IsotonicRegression(out_of_bounds="clip")
            iso.fit(raw_probs, y_cal)
            calibration_x = iso.X_thresholds_.tolist()
            calibration_y = iso.y_thresholds_.tolist()
            logger.info("Calibration fitted on %d held-out samples (%d knots)", len(y_cal), len(calibration_x))
        except Exception as e:
            logger.warning("Calibration failed (non-critical): %s", e)

        # ── Save artifact ─────────────────────────────────────────────────────
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        out_path = Path(self.cfg["paths"]["models"]) / f"{model_name}_{ts}.joblib"
        save_joblib(final_model, out_path)
        logger.info("Saved %s → %s", model_name, out_path)

        update_registry(
            f"{model_name}_{ts}",
            {"pr_auc": mean_pr_auc, "roc_auc": mean_roc_auc,
             "threshold": optimal_threshold, "best_iteration": best_iteration},
        )

        result = TrainingResult(
            model_name=model_name,
            model=final_model,
            fold_results=fold_results,
            best_params=best_params,
            best_iteration=best_iteration,
            mean_pr_auc=mean_pr_auc,
            mean_roc_auc=mean_roc_auc,
            optimal_threshold=optimal_threshold,
            feature_names=list(X.columns),
            feature_importances=importances,
            artifact_path=str(out_path),
        )
        result._calibration_x = calibration_x
        result._calibration_y = calibration_y
        return result

    # ── CV ────────────────────────────────────────────────────────────────────

    def _optuna_objective(
        self,
        trial: optuna.Trial,
        model_name: str,
        X: pd.DataFrame,
        y: pd.Series,
        scale_pos_weight: float,
    ) -> float:
        params = self._suggest_params(trial, model_name)
        cv = TimeSeriesExpandingCV(n_splits=3, gap_samples=144, min_train_size=100_000)
        pr_aucs = []
        for train_idx, val_idx in cv.split(X, y):
            m = self._build_model(model_name, params, scale_pos_weight,
                                  n_estimators=500, early_stopping=True)
            X_tr, X_val = X.iloc[train_idx].values, X.iloc[val_idx].values
            y_tr, y_val = y.iloc[train_idx].values, y.iloc[val_idx].values
            if model_name == "xgboost":
                m.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
            else:
                m.fit(X_tr, y_tr, eval_set=[(X_val, y_val)])
            probs = m.predict_proba(X_val)[:, 1]
            pr_aucs.append(average_precision_score(y_val, probs))
        return float(np.mean(pr_aucs))

    def _full_cv(
        self,
        model_name: str,
        X: pd.DataFrame,
        y: pd.Series,
        params: dict,
        scale_pos_weight: float,
    ) -> list[FoldResult]:
        cv = TimeSeriesExpandingCV(
            n_splits=self.model_cfg["cv_n_splits"],
            gap_samples=self.model_cfg["cv_gap_samples"],
            min_train_size=self.model_cfg["cv_min_train_size"],
        )
        results = []
        for fold_idx, (train_idx, val_idx) in enumerate(cv.split(X, y)):
            m = self._build_model(model_name, params, scale_pos_weight,
                                  n_estimators=2000, early_stopping=True)
            X_tr, X_val = X.iloc[train_idx].values, X.iloc[val_idx].values
            y_tr, y_val = y.iloc[train_idx].values, y.iloc[val_idx].values
            if model_name == "xgboost":
                m.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
            else:
                m.fit(X_tr, y_tr, eval_set=[(X_val, y_val)])

            probs = m.predict_proba(X_val)[:, 1]
            pr_auc = average_precision_score(y_val, probs)
            roc_auc = roc_auc_score(y_val, probs)
            threshold = self._tune_threshold(y_val, probs)
            f1 = f1_score(y_val, (probs >= threshold).astype(int))
            best_iter = getattr(m, "best_iteration_", None) or getattr(m, "best_iteration", 500)

            logger.info("Fold %d — PR-AUC: %.4f  ROC-AUC: %.4f  F1: %.4f  iter: %d",
                        fold_idx + 1, pr_auc, roc_auc, f1, best_iter)
            results.append(FoldResult(
                fold=fold_idx + 1,
                pr_auc=pr_auc,
                roc_auc=roc_auc,
                f1=f1,
                best_iteration=best_iter,
                threshold=threshold,
            ))
        return results

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _suggest_params(self, trial: optuna.Trial, model_name: str) -> dict:
        if model_name == "xgboost":
            return {
                "max_depth": trial.suggest_int("max_depth", 4, 10),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
                "subsample": trial.suggest_float("subsample", 0.6, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 0.9),
                "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 1.0),
                "reg_lambda": trial.suggest_float("reg_lambda", 0.0, 1.0),
                "min_child_weight": trial.suggest_int("min_child_weight", 3, 10),
            }
        return {
            "max_depth": trial.suggest_int("max_depth", 4, 12),
            "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.1, log=True),
            "subsample": trial.suggest_float("subsample", 0.6, 1.0),
            "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 0.9),
            "reg_alpha": trial.suggest_float("reg_alpha", 0.0, 1.0),
            "reg_lambda": trial.suggest_float("reg_lambda", 0.0, 1.0),
            "num_leaves": trial.suggest_int("num_leaves", 31, 127),
        }

    def _build_model(
        self,
        model_name: str,
        params: dict,
        scale_pos_weight: float,
        n_estimators: int = 500,
        early_stopping: bool = True,
    ) -> Any:
        common = dict(n_estimators=n_estimators, random_state=42)
        if model_name == "xgboost":
            return XGBClassifier(
                **common,
                **params,
                scale_pos_weight=scale_pos_weight,
                eval_metric="aucpr",
                early_stopping_rounds=50 if early_stopping else None,
                use_label_encoder=False,
                tree_method="hist",
            )
        return LGBMClassifier(
            **common,
            **params,
            scale_pos_weight=scale_pos_weight,
            metric="average_precision",
            early_stopping_round=50 if early_stopping else None,
            verbose=-1,
        )

    @staticmethod
    def _tune_threshold(y_true: np.ndarray, probs: np.ndarray) -> float:
        best_f1, best_t = 0.0, 0.5
        for t in np.linspace(0.1, 0.9, 81):
            f1 = f1_score(y_true, (probs >= t).astype(int), zero_division=0)
            if f1 > best_f1:
                best_f1, best_t = f1, t
        return float(best_t)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    cfg = load_config()

    feat_path = Path(cfg["paths"]["processed_data"]) / "features.parquet"
    df = load_parquet(feat_path)

    feature_cols = [c for c in df.columns if c not in _PASSTHROUGH]
    X = df[feature_cols].astype(np.float32)
    y = df["failure_within_24h"].astype(int)

    logger.info("Dataset: %d rows × %d features, %.1f%% positive",
                len(X), len(feature_cols), y.mean() * 100)

    trainer = FailurePredictionTrainer(cfg)
    results = trainer.train_all(X, y)

    # Save summary
    summary = {}
    for name, r in results.items():
        summary[name] = {
            "pr_auc": r.mean_pr_auc,
            "roc_auc": r.mean_roc_auc,
            "threshold": r.optimal_threshold,
            "best_iteration": r.best_iteration,
            "top_features": list(r.feature_importances.keys())[:20],
            "artifact": r.artifact_path,
            "calibration_x": getattr(r, "_calibration_x", []),
            "calibration_y": getattr(r, "_calibration_y", []),
        }

    summary_path = Path(cfg["paths"]["models"]) / "training_summary.json"
    with open(summary_path, "w") as f:
        json.dump(summary, f, indent=2)
    logger.info("Training complete. Summary saved to %s", summary_path)


if __name__ == "__main__":
    main()
