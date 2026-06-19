/**
 * Risk driver explainer.
 * Uses standardized deviation from healthy baseline × global feature importance
 * to produce ranked, plain-language risk factors.
 */

import type { FeatureRow } from "./features";

export interface FeatureSpec {
  feature_names: string[];
  features: Record<string, { mean: number; std: number; importance: number }>;
}

export interface RiskDriver {
  feature: string;
  label: string;
  direction: "increasing" | "decreasing" | "stable";
  deviation: number;       // z-score vs healthy baseline
  importance: number;      // global gain importance (normalized 0–1)
  score: number;           // |deviation| × importance
}

/* ── Feature name → human-readable label ─────────────────────────────────── */
const SENSOR_LABELS: Record<string, string> = {
  vibration_mm_s: "Vibration",
  temperature_c:  "Temperature",
  pressure_bar:   "Pressure",
  current_a:      "Current",
  rpm:            "RPM",
  acoustic_db:    "Acoustic level",
};

function humanize(featureName: string): string {
  // Cross-channel
  if (featureName === "feat_vibration_x_temp")   return "Vibration × temperature coupling";
  if (featureName === "feat_current_over_rpm")    return "Current draw relative to speed";
  if (featureName === "feat_power_proxy")         return "Estimated power draw";
  if (featureName === "feat_pressure_temp_ratio") return "Pressure-temperature ratio";

  for (const [col, label] of Object.entries(SENSOR_LABELS)) {
    if (!featureName.startsWith(col)) continue;
    const rest = featureName.slice(col.length + 1);

    if (rest.match(/^roll\d+_mean$/))  return `${label} (moving average)`;
    if (rest.match(/^roll\d+_std$/))   return `${label} variability`;
    if (rest.match(/^roll\d+_range$/)) return `${label} spread`;
    if (rest.match(/^ema\d+$/))        return `${label} trend`;
    if (rest.match(/^ema\d+_dev$/))    return `${label} deviation from trend`;
    if (rest.match(/^lag\d+$/))        return `${label} (recent level)`;
    if (rest.match(/^diff\d+$/))       return `${label} change over time`;
    if (rest.match(/^pct\d+$/))        return `${label} % change`;
    if (rest === "roc")                return `${label} rate of change`;
    if (rest === "roc_smooth")         return `${label} smoothed rate of change`;
    if (rest === "fft_energy")         return `${label} frequency energy`;
    if (rest === "fft_entropy")        return `${label} frequency irregularity`;
    return `${label} (${rest})`;
  }
  return featureName;
}

/* ── Compute top drivers for a single feature row ─────────────────────────── */
export function computeDrivers(
  features: FeatureRow,
  spec: FeatureSpec,
  topN = 6
): RiskDriver[] {
  const importances = Object.values(spec.features).map(f => f.importance);
  const maxImportance = Math.max(...importances, 1);

  const scored: RiskDriver[] = [];

  for (const name of spec.feature_names) {
    const meta = spec.features[name];
    if (!meta) continue;
    const val = features[name];
    if (val == null || isNaN(val)) continue;

    const deviation = meta.std > 0 ? (val - meta.mean) / meta.std : 0;
    const importanceNorm = meta.importance / maxImportance;
    const score = Math.abs(deviation) * importanceNorm;

    if (score < 0.05) continue;

    scored.push({
      feature: name,
      label: humanize(name),
      direction: deviation > 0.3 ? "increasing" : deviation < -0.3 ? "decreasing" : "stable",
      deviation,
      importance: importanceNorm,
      score,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/* ── Plain-language summary of top driver ────────────────────────────────── */
export function topDriverSummary(drivers: RiskDriver[]): string {
  if (drivers.length === 0) return "All sensor readings within normal bounds.";
  const top = drivers[0];
  const dir = top.direction === "increasing" ? "trending up sharply"
    : top.direction === "decreasing" ? "trending down sharply"
    : "behaving unusually";
  return `${top.label} is ${dir}`;
}

/* ── Recommended action based on risk level ──────────────────────────────── */
export function recommendedAction(riskLevel: string): { title: string; body: string; urgency: "low" | "medium" | "high" | "critical" } {
  switch (riskLevel?.toUpperCase()) {
    case "CRITICAL":
      return {
        title: "Immediate maintenance required",
        body: "Failure is expected within 24 hours. Stop the machine if safe to do so and dispatch a maintenance crew immediately.",
        urgency: "critical",
      };
    case "HIGH":
      return {
        title: "Schedule maintenance within 24 hours",
        body: "Multiple indicators show significant degradation. Arrange a maintenance window as soon as possible to prevent unplanned downtime.",
        urgency: "high",
      };
    case "MEDIUM":
      return {
        title: "Inspect within the week",
        body: "Early warning signs detected. Schedule a routine inspection soon — catching issues at this stage avoids emergency repairs.",
        urgency: "medium",
      };
    default:
      return {
        title: "Continue normal monitoring",
        body: "All sensors within expected ranges. No maintenance action needed. Next routine check as scheduled.",
        urgency: "low",
      };
  }
}
