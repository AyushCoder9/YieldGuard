/**
 * TypeScript port of src/yieldguard/features/engineer.py
 * Computes the portable feature subset for a single machine window.
 * All operations operate on a flat array of readings (chronological order).
 */

export const SENSOR_COLS = [
  "vibration_mm_s",
  "temperature_c",
  "pressure_bar",
  "current_a",
  "rpm",
  "acoustic_db",
] as const;

export type SensorCol = (typeof SENSOR_COLS)[number];

export interface SensorReading {
  vibration_mm_s: number;
  temperature_c: number;
  pressure_bar: number;
  current_a: number;
  rpm: number;
  acoustic_db: number;
}

export interface FeatureRow {
  [key: string]: number;
}

const ROLLING_WINDOWS = [6, 12, 36, 144];
const EWMA_SPANS = [12, 72];
const LAG_WINDOWS = [6, 12, 36, 144];
const FFT_WINDOW = 144;

/* ── Statistical helpers ──────────────────────────────────────────────────── */

function rollingMean(arr: number[], end: number, w: number): number {
  const start = Math.max(0, end - w + 1);
  const slice = arr.slice(start, end + 1);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function rollingStd(arr: number[], end: number, w: number): number {
  const start = Math.max(0, end - w + 1);
  const slice = arr.slice(start, end + 1);
  const n = slice.length;
  if (n < 2) return 0;
  const mean = slice.reduce((a, b) => a + b, 0) / n;
  const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

function rollingRange(arr: number[], end: number, w: number): number {
  const start = Math.max(0, end - w + 1);
  const slice = arr.slice(start, end + 1);
  return Math.max(...slice) - Math.min(...slice);
}

function ewma(arr: number[], end: number, span: number): number {
  const alpha = 2 / (span + 1);
  let ema = arr[0] ?? 0;
  for (let i = 1; i <= end && i < arr.length; i++) {
    ema = alpha * arr[i] + (1 - alpha) * ema;
  }
  return ema;
}

function ewmaFull(arr: number[], span: number): number[] {
  const alpha = 2 / (span + 1);
  const result = new Array(arr.length);
  result[0] = arr[0] ?? 0;
  for (let i = 1; i < arr.length; i++) {
    result[i] = alpha * arr[i] + (1 - alpha) * result[i - 1];
  }
  return result;
}

/* ── Rolling skew (Fisher-Pearson adjusted, matches pandas rolling.skew) ──── */
function rollingSkew(arr: number[], end: number, w: number): number {
  const start = Math.max(0, end - w + 1);
  const slice = arr.slice(start, end + 1);
  const n = slice.length;
  if (n < 3) return 0;
  const mean = slice.reduce((a, b) => a + b, 0) / n;
  const s2 = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const s = Math.sqrt(s2);
  if (s < 1e-10) return 0;
  const m3 = slice.reduce((a, b) => a + ((b - mean) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * m3;
}

/* ── Rolling excess kurtosis (unbiased, matches pandas rolling.kurt) ─────── */
function rollingKurt(arr: number[], end: number, w: number): number {
  const start = Math.max(0, end - w + 1);
  const slice = arr.slice(start, end + 1);
  const n = slice.length;
  if (n < 4) return 0;
  const mean = slice.reduce((a, b) => a + b, 0) / n;
  const s2 = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  if (s2 < 1e-10) return 0;
  const m4 = slice.reduce((a, b) => a + (b - mean) ** 4, 0);
  return (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3)) * (m4 / (s2 * s2)) -
         3 * (n - 1) ** 2 / ((n - 2) * (n - 3));
}

/* ── FFT via DFT — single pass returns energy, dominant bin, entropy ─────── */
function computeFFT(segment: number[]): { energy: number; domHz: number; entropy: number } {
  const n = segment.length;
  if (n < 2) return { energy: 0, domHz: 1, entropy: 0 };
  const half = Math.floor(n / 2) + 1;
  const powers = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    let re = 0, im = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      re += segment[t] * Math.cos(angle);
      im -= segment[t] * Math.sin(angle);
    }
    powers[k] = re * re + im * im;
  }
  let energy = 0, domHz = 1, maxPow = 0;
  for (let k = 1; k < half; k++) {
    energy += powers[k];
    if (powers[k] > maxPow) { maxPow = powers[k]; domHz = k; }
  }
  const total = powers.reduce((a, b) => a + b, 0) + 1e-10;
  let entropy = 0;
  for (let k = 0; k < half; k++) {
    const p = powers[k] / total;
    if (p > 0) entropy -= p * Math.log(p);
  }
  return { energy, domHz, entropy };
}

/* ── Clip pct_change to [-10, 10] as in Python ──────────────────────────── */
function pctChange(arr: number[], i: number, lag: number): number {
  const prev = arr[i - lag];
  if (prev == null || Math.abs(prev) < 1e-10) return 0;
  const pct = (arr[i] - prev) / Math.abs(prev);
  return Math.max(-10, Math.min(10, pct));
}

/* ── Main feature computation ─────────────────────────────────────────────── */

/**
 * Compute the portable feature vector for the LAST row of the window.
 * `readings` must be sorted chronologically (oldest first).
 * Minimum length: 144 (= largest rolling window). Pad with first value if shorter.
 */
export function computeFeatures(readings: SensorReading[]): FeatureRow {
  if (readings.length === 0) throw new Error("readings must not be empty");

  // Ensure at least FFT_WINDOW samples (pad with first reading)
  const padded = readings.length < FFT_WINDOW
    ? [...Array(FFT_WINDOW - readings.length).fill(readings[0]), ...readings]
    : readings;

  const i = padded.length - 1; // target index (last row)

  const features: FeatureRow = {};

  for (const col of SENSOR_COLS) {
    const arr = padded.map(r => r[col] ?? 0);
    const val = arr[i];

    // Raw sensor value (Column_0..5 in model)
    features[col] = val;

    // Rolling mean, std, range, skew, kurt
    for (const w of ROLLING_WINDOWS) {
      features[`${col}_roll${w}_mean`]  = rollingMean(arr, i, w);
      features[`${col}_roll${w}_std`]   = rollingStd(arr, i, w);
      features[`${col}_roll${w}_range`] = rollingRange(arr, i, w);
      features[`${col}_roll${w}_skew`]  = rollingSkew(arr, i, w);
      features[`${col}_roll${w}_kurt`]  = rollingKurt(arr, i, w);
    }

    // EWMA + deviation
    const emaFull12 = ewmaFull(arr, EWMA_SPANS[0]);
    const emaFull72 = ewmaFull(arr, EWMA_SPANS[1]);
    features[`${col}_ema12`]     = emaFull12[i];
    features[`${col}_ema12_dev`] = val - emaFull12[i];
    features[`${col}_ema72`]     = emaFull72[i];
    features[`${col}_ema72_dev`] = val - emaFull72[i];

    // Lags, diffs, pct_change
    for (const lag of LAG_WINDOWS) {
      const lagged = arr[i - lag] ?? arr[0];
      features[`${col}_lag${lag}`]  = lagged;
      features[`${col}_diff${lag}`] = val - lagged;
      features[`${col}_pct${lag}`]  = pctChange(arr, i, lag);
    }

    // Rate of change (diff of 1 step + smoothed)
    const roc = i > 0 ? val - arr[i - 1] : 0;
    features[`${col}_roc`] = roc;
    const rocSmooth = (
      (i > 0 ? arr[i]   - arr[i - 1] : 0) +
      (i > 1 ? arr[i-1] - arr[i - 2] : 0) +
      (i > 2 ? arr[i-2] - arr[i - 3] : 0) +
      (i > 3 ? arr[i-3] - arr[i - 4] : 0) +
      (i > 4 ? arr[i-4] - arr[i - 5] : 0) +
      (i > 5 ? arr[i-5] - arr[i - 6] : 0)
    ) / 6;
    features[`${col}_roc_smooth`] = rocSmooth;

    // FFT — single DFT pass for energy, dominant bin, entropy
    const fftSeg = arr.slice(Math.max(0, i - FFT_WINDOW + 1), i + 1);
    const padFft = fftSeg.length < FFT_WINDOW
      ? [...Array(FFT_WINDOW - fftSeg.length).fill(fftSeg[0] ?? 0), ...fftSeg]
      : fftSeg;
    const { energy, domHz, entropy } = computeFFT(padFft);
    features[`${col}_fft_energy`]  = energy;
    features[`${col}_fft_dom_hz`]  = domHz;
    features[`${col}_fft_entropy`] = entropy;
  }

  // Cross-channel features
  const vib  = padded[i].vibration_mm_s;
  const temp = padded[i].temperature_c;
  const cur  = padded[i].current_a;
  const rpm  = Math.max(padded[i].rpm, 1.0);
  const pres = padded[i].pressure_bar;

  features["feat_vibration_x_temp"]      = vib * temp;
  features["feat_current_over_rpm"]       = cur / rpm;
  features["feat_power_proxy"]            = cur * vib;
  features["feat_pressure_temp_ratio"]    = pres / Math.max(temp, 1.0);

  return features;
}

/**
 * Compute features for every row in the window (for timeline playback in demo).
 * Returns one FeatureRow per input reading (i ≥ 1 for diff/lag to be meaningful).
 */
export function computeFeatureTimeline(readings: SensorReading[], step = 1): FeatureRow[] {
  if (readings.length === 0) return [];
  const results: FeatureRow[] = [];
  for (let end = 0; end < readings.length; end += step) {
    const window = readings.slice(0, end + 1);
    results.push(computeFeatures(window));
  }
  return results;
}
