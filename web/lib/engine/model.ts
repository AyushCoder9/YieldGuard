/**
 * LightGBM tree-ensemble scorer.
 * Reads the JSON dumped by `lgb_model.booster_.dump_model()`.
 * Walks trees, sums leaf values, applies sigmoid + calibration.
 */

import type { FeatureRow } from "./features";

/* ── Types matching LightGBM dump_model() output ─────────────────────────── */
interface TreeNode {
  split_feature?: number;
  split_gain?: number;
  threshold?: number | string;
  decision_type?: string;
  default_left?: boolean;
  left_child?: TreeNode;
  right_child?: TreeNode;
  leaf_value?: number;
}

interface TreeInfo {
  tree_index: number;
  feature_names: string[];
  tree_structure: TreeNode;
}

export interface ModelSpec {
  feature_names: string[];
  tree_info: TreeInfo[];
  num_class: number;
  threshold: number;
  calibration_x: number[];
  calibration_y: number[];
  pr_auc: number;
  roc_auc: number;
}

/* ── Sigmoid ──────────────────────────────────────────────────────────────── */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/* ── Isotonic calibration (linear interpolation through knots) ───────────── */
function calibrate(raw: number, calX: number[], calY: number[]): number {
  if (calX.length === 0 || calY.length === 0) return raw;
  if (raw <= calX[0]) return calY[0];
  if (raw >= calX[calX.length - 1]) return calY[calY.length - 1];
  for (let i = 0; i < calX.length - 1; i++) {
    if (raw >= calX[i] && raw <= calX[i + 1]) {
      const t = (raw - calX[i]) / (calX[i + 1] - calX[i]);
      return calY[i] + t * (calY[i + 1] - calY[i]);
    }
  }
  return raw;
}

/* ── Walk one tree node ───────────────────────────────────────────────────── */
function scoreNode(node: TreeNode, featureVals: number[]): number {
  if (node.leaf_value !== undefined) return node.leaf_value;

  const featIdx = node.split_feature!;
  const threshold = typeof node.threshold === "string"
    ? parseFloat(node.threshold)
    : node.threshold!;
  const val = featureVals[featIdx];

  const goLeft = isNaN(val)
    ? (node.default_left !== false)
    : val <= threshold;

  return goLeft
    ? scoreNode(node.left_child!, featureVals)
    : scoreNode(node.right_child!, featureVals);
}

/* ── Score a full ensemble ────────────────────────────────────────────────── */
export function scoreModel(
  spec: ModelSpec,
  features: FeatureRow
): { probability: number; rawScore: number; riskLevel: string } {
  const featureVals = spec.feature_names.map(name => features[name] ?? NaN);

  let rawScore = 0;
  for (const tree of spec.tree_info) {
    rawScore += scoreNode(tree.tree_structure, featureVals);
  }

  const rawProb = sigmoid(rawScore);
  const calibrated = calibrate(rawProb, spec.calibration_x, spec.calibration_y);
  const probability = Math.max(0, Math.min(1, calibrated));

  const riskLevel =
    probability >= 0.75 ? "CRITICAL" :
    probability >= 0.50 ? "HIGH" :
    probability >= 0.25 ? "MEDIUM" :
    "LOW";

  return { probability, rawScore, riskLevel };
}

/* ── Load model from JSON (call once, cache the result) ──────────────────── */
let _cachedModel: ModelSpec | null = null;

export async function loadModel(): Promise<ModelSpec> {
  if (_cachedModel) return _cachedModel;
  const res = await fetch("/lib/engine/model.json");
  if (!res.ok) throw new Error(`Failed to load model.json: ${res.status}`);
  _cachedModel = await res.json() as ModelSpec;
  return _cachedModel;
}

export function setModel(spec: ModelSpec) {
  _cachedModel = spec;
}

export function riskColor(level: string): string {
  switch (level) {
    case "CRITICAL": return "#FB3B5C";
    case "HIGH":
    case "MEDIUM":   return "#F5A524";
    default:         return "#2DD4BF";
  }
}

export function riskVariant(level: string): "danger" | "caution" | "healthy" {
  switch (level) {
    case "CRITICAL": return "danger";
    case "HIGH":
    case "MEDIUM":   return "caution";
    default:         return "healthy";
  }
}
