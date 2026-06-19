/**
 * Unit tests for the TypeScript in-browser engine:
 *   features.ts — rolling stats, EWMA, FFT, pct_change clipping
 *   model.ts    — tree scoring, sigmoid, calibration
 */

import { describe, it, expect } from "vitest";
import {
  computeFeatures,
  SENSOR_COLS,
  type SensorReading,
} from "../lib/engine/features";
import { scoreModel, type ModelSpec } from "../lib/engine/model";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeReading(overrides: Partial<SensorReading> = {}): SensorReading {
  return {
    vibration_mm_s: 2.5,
    temperature_c: 65.0,
    pressure_bar: 8.0,
    current_a: 12.0,
    rpm: 1475.0,
    acoustic_db: 72.0,
    ...overrides,
  };
}

function makeWindow(n: number, overrides: Partial<SensorReading> = {}): SensorReading[] {
  return Array.from({ length: n }, () => makeReading(overrides));
}

// ── features.ts ──────────────────────────────────────────────────────────────

describe("computeFeatures", () => {
  it("returns a non-empty feature object", () => {
    const features = computeFeatures(makeWindow(144));
    expect(Object.keys(features).length).toBeGreaterThan(50);
  });

  it("contains rolling mean features for all sensors", () => {
    const features = computeFeatures(makeWindow(144));
    for (const col of SENSOR_COLS) {
      for (const w of [6, 12, 36, 144]) {
        expect(features).toHaveProperty(`${col}_roll${w}_mean`);
      }
    }
  });

  it("contains EWMA features for all sensors", () => {
    const features = computeFeatures(makeWindow(144));
    for (const col of SENSOR_COLS) {
      expect(features).toHaveProperty(`${col}_ema12`);
      expect(features).toHaveProperty(`${col}_ema72`);
    }
  });

  it("contains FFT features for all sensors", () => {
    const features = computeFeatures(makeWindow(144));
    for (const col of SENSOR_COLS) {
      expect(features).toHaveProperty(`${col}_fft_energy`);
    }
  });

  it("rolling mean equals constant value for constant signal", () => {
    const VAL = 5.0;
    const features = computeFeatures(makeWindow(144, { vibration_mm_s: VAL }));
    expect(features["vibration_mm_s_roll6_mean"]).toBeCloseTo(VAL, 6);
    expect(features["vibration_mm_s_roll144_mean"]).toBeCloseTo(VAL, 6);
  });

  it("rolling std is 0 for constant signal", () => {
    const features = computeFeatures(makeWindow(144, { vibration_mm_s: 3.0 }));
    expect(features["vibration_mm_s_roll6_std"]).toBeCloseTo(0, 6);
  });

  it("rolling range is 0 for constant signal", () => {
    const features = computeFeatures(makeWindow(144, { pressure_bar: 8.0 }));
    expect(features["pressure_bar_roll6_range"]).toBeCloseTo(0, 6);
  });

  it("pct_change features are clipped to [-10, 10]", () => {
    // Step from 0.001 to 100 → raw pct_change would be ~99900% (> 10)
    const window: SensorReading[] = [
      ...makeWindow(143),
      makeReading({ vibration_mm_s: 100.0 }),
    ];
    const features = computeFeatures(window);
    const pctKey = Object.keys(features).find(
      k => k.startsWith("vibration_mm_s") && k.includes("pct")
    );
    if (pctKey) {
      expect(features[pctKey]).toBeLessThanOrEqual(10);
      expect(features[pctKey]).toBeGreaterThanOrEqual(-10);
    }
  });

  it("pads short windows without throwing", () => {
    expect(() => computeFeatures(makeWindow(10))).not.toThrow();
  });

  it("throws on empty input", () => {
    expect(() => computeFeatures([])).toThrow();
  });

  it("all feature values are finite numbers", () => {
    const features = computeFeatures(makeWindow(144));
    for (const [key, val] of Object.entries(features)) {
      expect(Number.isFinite(val), `${key} = ${val} is not finite`).toBe(true);
    }
  });

  it("fft_energy is 0 for pure DC (constant signal)", () => {
    // DC signal has energy only at k=0, which we skip in fftEnergy
    const features = computeFeatures(makeWindow(144, { vibration_mm_s: 5.0 }));
    expect(features["vibration_mm_s_fft_energy"]).toBeCloseTo(0, 3);
  });

  it("fft_energy increases for high-frequency signal", () => {
    const alternating: SensorReading[] = Array.from({ length: 144 }, (_, i) =>
      makeReading({ vibration_mm_s: i % 2 === 0 ? 1.0 : -1.0 })
    );
    const flat = makeWindow(144, { vibration_mm_s: 0.0 });
    const featAlt = computeFeatures(alternating);
    const featFlat = computeFeatures(flat);
    expect(featAlt["vibration_mm_s_fft_energy"]).toBeGreaterThan(
      featFlat["vibration_mm_s_fft_energy"]
    );
  });
});

// ── model.ts ─────────────────────────────────────────────────────────────────

describe("scoreModel", () => {
  const minimalSpec: ModelSpec = {
    feature_names: ["f0", "f1"],
    tree_info: [
      {
        tree_index: 0,
        feature_names: ["f0", "f1"],
        tree_structure: {
          split_feature: 0,
          threshold: 0.5,
          decision_type: "<=",
          default_left: true,
          left_child: { leaf_value: -1.0 },
          right_child: { leaf_value: 1.0 },
        },
      },
    ],
    num_class: 1,
    threshold: 0.5,
    calibration_x: [],
    calibration_y: [],
    pr_auc: 0.85,
    roc_auc: 0.97,
  };

  it("returns probability in [0, 1]", () => {
    const result = scoreModel(minimalSpec, { f0: 0.0, f1: 0.0 });
    expect(result.probability).toBeGreaterThanOrEqual(0);
    expect(result.probability).toBeLessThanOrEqual(1);
  });

  it("routes left on feature ≤ threshold", () => {
    const left = scoreModel(minimalSpec, { f0: 0.3, f1: 0.0 });
    const right = scoreModel(minimalSpec, { f0: 0.8, f1: 0.0 });
    expect(left.probability).toBeLessThan(right.probability);
  });

  it("uses default_left for NaN features", () => {
    const leftDefault = scoreModel(minimalSpec, { f0: NaN, f1: 0.0 });
    const leftExplicit = scoreModel(minimalSpec, { f0: 0.0, f1: 0.0 });
    expect(leftDefault.probability).toBeCloseTo(leftExplicit.probability, 3);
  });

  it("returns riskLevel string", () => {
    const result = scoreModel(minimalSpec, { f0: 0.0 });
    expect(typeof result.riskLevel).toBe("string");
    expect(["OPERATIONAL", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(result.riskLevel);
  });

  it("calibration shifts probability", () => {
    const specWithCal: ModelSpec = {
      ...minimalSpec,
      calibration_x: [0.0, 0.5, 1.0],
      calibration_y: [0.0, 0.8, 1.0],
    };
    const withCal = scoreModel(specWithCal, { f0: 0.8 });
    const withoutCal = scoreModel(minimalSpec, { f0: 0.8 });
    // With calibration mapped higher, probability should differ
    expect(withCal.probability).not.toBeCloseTo(withoutCal.probability, 2);
  });

  it("rawScore is returned alongside probability", () => {
    const result = scoreModel(minimalSpec, { f0: 0.0 });
    expect(typeof result.rawScore).toBe("number");
  });
});
