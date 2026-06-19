export interface SensorWindow {
  vibration: number[];
  temperature: number[];
  pressure: number[];
  current: number[];
  rpm: number[];
  acoustic: number[];
}

export interface PredictionResult {
  probability: number;
  rawScore: number;
  label: "OPERATIONAL" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  confidence: number;
  drivers: RiskDriver[];
  warmingUp: boolean;
  featureVector: Record<string, number>;
}

export interface RiskDriver {
  name: string;
  value: number;
  baseline: number;
  deviation: number;
  direction: "high" | "low";
  importance: number;
  description: string;
}

export interface TreeNode {
  split_feature?: number;
  threshold?: string | number;
  decision_type?: string;
  default_left?: boolean;
  left_child?: TreeNode;
  right_child?: TreeNode;
  leaf_value?: number;
  leaf_index?: number;
  internal_value?: number;
}

export interface TreeInfo {
  tree_structure: TreeNode;
  shrinkage?: number;
  num_leaves?: number;
}

export interface ModelData {
  tree_info: TreeInfo[];
  feature_names: string[];
  threshold: number;
  calibration_x: number[];
  calibration_y: number[];
  pr_auc: number;
  roc_auc: number;
}

export interface FeatureSpec {
  feature_names: string[];
  rolling_windows: number[];
  ewma_spans: number[];
  lag_windows: number[];
  fft_window: number;
  sensor_cols: string[];
  features: Record<string, { mean: number; std: number; importance: number }>;
  sensor_baselines: Record<string, {
    mean: number;
    std: number;
    bounds: [number, number];
    degradation_direction: number;
  }>;
}
