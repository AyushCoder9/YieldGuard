/**
 * Main orchestration: sensor readings → prediction result.
 * Shared by Demo and Dashboard pages.
 */

import { computeFeatures, type SensorReading } from "./features";
import { scoreModel, type ModelSpec } from "./model";
import { computeDrivers, recommendedAction, type RiskDriver, type FeatureSpec } from "./explain";

export interface PredictionResult {
  probability: number;
  riskLevel: string;
  riskVariant: "healthy" | "caution" | "danger";
  drivers: RiskDriver[];
  recommendation: { title: string; body: string; urgency: "low" | "medium" | "high" | "critical" };
  timestamp: string;
  windowSize: number;
  warmingUp: boolean;
}

const MIN_WINDOW = 144;

export function predict(
  readings: SensorReading[],
  modelSpec: ModelSpec,
  featureSpec: FeatureSpec
): PredictionResult {
  const warmingUp = readings.length < MIN_WINDOW;

  const features = computeFeatures(readings);
  const { probability, riskLevel } = warmingUp
    ? { probability: 0, riskLevel: "LOW" }
    : scoreModel(modelSpec, features);

  const drivers = warmingUp ? [] : computeDrivers(features, featureSpec);
  const recommendation = recommendedAction(riskLevel);

  const variant: "healthy" | "caution" | "danger" =
    riskLevel === "CRITICAL" ? "danger" :
    (riskLevel === "HIGH" || riskLevel === "MEDIUM") ? "caution" :
    "healthy";

  return {
    probability,
    riskLevel,
    riskVariant: variant,
    drivers,
    recommendation,
    timestamp: new Date().toISOString(),
    windowSize: readings.length,
    warmingUp,
  };
}

/* ── Synthesize readings from slider values ───────────────────────────────── */
export interface SliderValues {
  vibration: number;
  temperature: number;
  pressure: number;
  current: number;
  rpm: number;
  acoustic: number;
  trend: "healthy" | "degrading" | "critical";
}

const SENSOR_BASELINES = {
  vibration_mm_s: { mean: 2.5,  std: 0.8  },
  temperature_c:  { mean: 65.0, std: 3.0  },
  pressure_bar:   { mean: 8.0,  std: 0.5  },
  current_a:      { mean: 12.0, std: 1.5  },
  rpm:            { mean: 1475, std: 10.0 },
  acoustic_db:    { mean: 72.0, std: 4.0  },
};

export function synthesizeReadings(sliders: SliderValues, length = 288): SensorReading[] {
  const { vibration, temperature, pressure, current, rpm, acoustic, trend } = sliders;
  const readings: SensorReading[] = [];

  for (let i = 0; i < length; i++) {
    const t = i / length;
    const degradation = trend === "critical" ? t * 1.5
      : trend === "degrading" ? t * 0.6
      : 0;

    const noise = () => (Math.random() - 0.5) * 0.15;

    readings.push({
      vibration_mm_s: vibration  * (1 + degradation * 0.8)  + noise() * SENSOR_BASELINES.vibration_mm_s.std,
      temperature_c:  temperature * (1 + degradation * 0.5)  + noise() * SENSOR_BASELINES.temperature_c.std,
      pressure_bar:   pressure   * (1 - degradation * 0.3)  + noise() * SENSOR_BASELINES.pressure_bar.std,
      current_a:      current    * (1 + degradation * 0.6)  + noise() * SENSOR_BASELINES.current_a.std,
      rpm:            rpm        * (1 - degradation * 0.2)  + noise() * SENSOR_BASELINES.rpm.std,
      acoustic_db:    acoustic   * (1 + degradation * 0.9)  + noise() * SENSOR_BASELINES.acoustic_db.std,
    });
  }

  return readings;
}

/* ── Parse CSV rows into SensorReadings ──────────────────────────────────── */
export function parseCSVToReadings(
  rows: Record<string, string>[],
  errors: string[] = []
): SensorReading[] {
  const COL_MAP: Record<string, keyof SensorReading> = {
    vibration_mm_s:  "vibration_mm_s",
    vibration:       "vibration_mm_s",
    temperature_c:   "temperature_c",
    temperature:     "temperature_c",
    pressure_bar:    "pressure_bar",
    pressure:        "pressure_bar",
    current_a:       "current_a",
    current:         "current_a",
    rpm:             "rpm",
    acoustic_db:     "acoustic_db",
    acoustic:        "acoustic_db",
  };

  return rows.map((row, idx) => {
    const reading: Partial<SensorReading> = {};
    for (const [rawKey, val] of Object.entries(row)) {
      const key = rawKey.trim().toLowerCase();
      const mapped = COL_MAP[key];
      if (mapped) {
        const n = parseFloat(val);
        if (isNaN(n)) errors.push(`Row ${idx + 1}: "${rawKey}" is not a number`);
        else reading[mapped] = n;
      }
    }
    return reading as SensorReading;
  }).filter(r => Object.keys(r).length === 6);
}

/* ── Generate CSV template content ───────────────────────────────────────── */
export function csvTemplate(): string {
  const header = "timestamp,vibration_mm_s,temperature_c,pressure_bar,current_a,rpm,acoustic_db";
  const example = [
    "2024-01-01T00:00,2.45,64.8,8.1,12.1,1476,71.8",
    "2024-01-01T00:10,2.51,65.0,8.0,12.0,1474,72.1",
    "2024-01-01T00:20,2.48,65.2,7.9,12.2,1477,71.9",
  ];
  return [header, ...example].join("\n");
}
