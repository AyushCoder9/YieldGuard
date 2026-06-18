/**
 * DEMO DATA — completely isolated from real API/data.
 * No imports from real dashboard or API client.
 * All data is pre-computed, deterministic, and static.
 */

export interface DemoSensorSeries {
  timestamps: string[];
  vibration: number[];
  temperature: number[];
  pressure: number[];
  current: number[];
  rpm: number[];
  acoustic: number[];
  failureProbability: number[];
  labels: number[]; // 0=normal, 1=warning, 2=critical
}

export interface DemoMachine {
  id: string;
  name: string;
  type: string;
  location: string;
  age_years: number;
  currentStatus: "OPERATIONAL" | "WARNING" | "HIGH" | "CRITICAL";
  failureProbability: number;
  lastReading: {
    vibration: number;
    temperature: number;
    pressure: number;
    current: number;
    rpm: number;
    acoustic: number;
    timestamp: string;
  };
  topRiskFactors: Array<{ feature: string; importance: number; direction: "increasing" | "decreasing" | "neutral" }>;
  series: DemoSensorSeries;
}

// ── Deterministic pseudo-random ────────────────────────────────────────────
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateSeries(seed: number, failureAt: number, length = 720): DemoSensorSeries {
  const rng = seededRandom(seed);
  const ts: string[] = [];
  const vib: number[] = [], tmp: number[] = [], prs: number[] = [];
  const cur: number[] = [], rpm: number[] = [], aco: number[] = [];
  const fp: number[] = [], lbl: number[] = [];

  const now = new Date("2024-06-01T00:00:00Z");
  const WINDOW = 144; // 24h lookahead

  for (let i = 0; i < length; i++) {
    const t = new Date(now.getTime() + i * 10 * 60 * 1000);
    ts.push(t.toISOString());

    // Time to failure
    const ttf = failureAt - i;
    const progress = ttf < WINDOW * 3 && ttf > 0
      ? 1 - ttf / (WINDOW * 3)
      : 0;
    const ramp = progress > 0 ? (Math.exp(3 * progress) - 1) / (Math.E ** 3 - 1) : 0;
    const seasonal = 0.15 * Math.sin(2 * Math.PI * i / 144 + 0.7);
    const n = () => (rng() - 0.5) * 2;

    vib.push(+(2.5 + seasonal * 0.3 + ramp * 6  + n() * 0.4).toFixed(3));
    tmp.push(+(65  + seasonal * 2   + ramp * 18  + n() * 1.5).toFixed(2));
    prs.push(+(8   - seasonal * 0.1 - ramp * 3   + n() * 0.2).toFixed(3));
    cur.push(+(12  + seasonal * 0.5 + ramp * 8   + n() * 0.8).toFixed(3));
    rpm.push(+(1475 - seasonal * 5  - ramp * 60  + n() * 5).toFixed(1));
    aco.push(+(72  + seasonal * 1   + ramp * 20  + n() * 2).toFixed(2));

    // Failure probability based on time to failure
    const rawFp = ttf < WINDOW ? Math.min(0.99, 0.15 + 0.84 * (1 - ttf / WINDOW)) :
                  ttf < WINDOW * 3 ? Math.max(0.04, 0.12 * ramp) : 0.03 + rng() * 0.06;
    fp.push(+rawFp.toFixed(3));
    lbl.push(rawFp > 0.75 ? 2 : rawFp > 0.35 ? 1 : 0);
  }

  return { timestamps: ts, vibration: vib, temperature: tmp, pressure: prs, current: cur, rpm, acoustic: aco, failureProbability: fp, labels: lbl };
}

// ── Demo fleet ────────────────────────────────────────────────────────────
export const DEMO_MACHINES: DemoMachine[] = [
  {
    id: "M-001",
    name: "Hydraulic Press Alpha",
    type: "Hydraulic Press",
    location: "Cell A — Bay 3",
    age_years: 8,
    currentStatus: "CRITICAL",
    failureProbability: 0.89,
    lastReading: { vibration: 8.4, temperature: 87.2, pressure: 5.1, current: 18.7, rpm: 1390, acoustic: 94.3, timestamp: "2024-06-06T11:50:00Z" },
    topRiskFactors: [
      { feature: "vibration_roll144_mean", importance: 0.182, direction: "increasing" },
      { feature: "temperature_ema72_dev",  importance: 0.141, direction: "increasing" },
      { feature: "pressure_diff144",       importance: 0.127, direction: "decreasing" },
      { feature: "acoustic_fft_energy",    importance: 0.098, direction: "increasing" },
      { feature: "current_over_rpm",       importance: 0.076, direction: "increasing" },
    ],
    series: generateSeries(1337, 690),
  },
  {
    id: "M-007",
    name: "CNC Spindle Unit 7",
    type: "CNC Spindle",
    location: "Cell B — Bay 1",
    age_years: 3,
    currentStatus: "HIGH",
    failureProbability: 0.61,
    lastReading: { vibration: 5.2, temperature: 72.8, pressure: 7.4, current: 14.9, rpm: 1431, acoustic: 81.2, timestamp: "2024-06-06T11:50:00Z" },
    topRiskFactors: [
      { feature: "rpm_lag144",            importance: 0.156, direction: "decreasing" },
      { feature: "vibration_roll36_std",  importance: 0.134, direction: "increasing" },
      { feature: "current_ema12_dev",     importance: 0.108, direction: "increasing" },
      { feature: "acoustic_roll144_skew", importance: 0.092, direction: "increasing" },
      { feature: "feat_power_proxy",      importance: 0.071, direction: "increasing" },
    ],
    series: generateSeries(2048, 540),
  },
  {
    id: "M-012",
    name: "Coolant Pump P-12",
    type: "Centrifugal Pump",
    location: "Utility Corridor",
    age_years: 11,
    currentStatus: "WARNING",
    failureProbability: 0.34,
    lastReading: { vibration: 3.8, temperature: 68.4, pressure: 7.8, current: 13.1, rpm: 1458, acoustic: 75.6, timestamp: "2024-06-06T11:50:00Z" },
    topRiskFactors: [
      { feature: "pressure_roll144_mean", importance: 0.143, direction: "decreasing" },
      { feature: "vibration_roc_smooth",  importance: 0.121, direction: "increasing" },
      { feature: "temperature_pct144",    importance: 0.099, direction: "increasing" },
      { feature: "rpm_roll36_std",        importance: 0.087, direction: "increasing" },
      { feature: "feat_pressure_temp_ratio", importance: 0.064, direction: "decreasing" },
    ],
    series: generateSeries(3001, 480),
  },
  {
    id: "M-023",
    name: "Conveyor Drive DC-23",
    type: "Drive System",
    location: "Assembly Line 2",
    age_years: 5,
    currentStatus: "OPERATIONAL",
    failureProbability: 0.08,
    lastReading: { vibration: 2.3, temperature: 63.1, pressure: 8.2, current: 11.4, rpm: 1481, acoustic: 70.9, timestamp: "2024-06-06T11:50:00Z" },
    topRiskFactors: [
      { feature: "vibration_roll144_mean", importance: 0.112, direction: "increasing" },
      { feature: "current_ema72",          importance: 0.089, direction: "neutral" },
      { feature: "rpm_lag6",              importance: 0.071, direction: "neutral" },
      { feature: "temperature_roll12_std", importance: 0.058, direction: "neutral" },
      { feature: "acoustic_roc",          importance: 0.042, direction: "neutral" },
    ],
    series: generateSeries(4242, 850),
  },
  {
    id: "M-041",
    name: "Air Compressor AC-41",
    type: "Compressor",
    location: "Cell C — Bay 2",
    age_years: 2,
    currentStatus: "OPERATIONAL",
    failureProbability: 0.05,
    lastReading: { vibration: 2.1, temperature: 61.7, pressure: 8.4, current: 11.8, rpm: 1477, acoustic: 69.4, timestamp: "2024-06-06T11:50:00Z" },
    topRiskFactors: [
      { feature: "pressure_ema72",        importance: 0.094, direction: "neutral" },
      { feature: "vibration_roll6_mean",  importance: 0.078, direction: "neutral" },
      { feature: "acoustic_fft_entropy",  importance: 0.061, direction: "neutral" },
      { feature: "current_roll12_std",    importance: 0.049, direction: "neutral" },
      { feature: "rpm_diff6",             importance: 0.038, direction: "neutral" },
    ],
    series: generateSeries(5555, 900),
  },
];

export const DEMO_FLEET_STATS = {
  total: 50,
  operational: 38,
  warning: 7,
  high: 3,
  critical: 2,
  avgPrAuc: 0.847,
  avgRocAuc: 0.923,
  featuresEngineered: 256,
  dataPoints: 500443,
  modelsEnsemble: "XGBoost + LightGBM",
};

export const DEMO_MODEL_METRICS = {
  xgboost: { prAuc: 0.851, rocAuc: 0.926, f1: 0.783, recall: 0.821, precision: 0.748, threshold: 0.42 },
  lightgbm: { prAuc: 0.843, rocAuc: 0.919, f1: 0.779, recall: 0.814, precision: 0.745, threshold: 0.44 },
};

export const DEMO_TOP_FEATURES = [
  { feature: "vibration_roll144_mean",   importance: 0.0742 },
  { feature: "temperature_ema72_dev",    importance: 0.0681 },
  { feature: "vibration_fft_energy",     importance: 0.0634 },
  { feature: "pressure_diff144",         importance: 0.0598 },
  { feature: "acoustic_roll144_mean",    importance: 0.0571 },
  { feature: "current_over_rpm",         importance: 0.0523 },
  { feature: "rpm_lag144",               importance: 0.0489 },
  { feature: "vibration_roll36_std",     importance: 0.0452 },
  { feature: "temperature_pct144",       importance: 0.0431 },
  { feature: "feat_power_proxy",         importance: 0.0398 },
  { feature: "acoustic_fft_entropy",     importance: 0.0376 },
  { feature: "pressure_roll144_std",     importance: 0.0354 },
  { feature: "current_ema72_dev",        importance: 0.0337 },
  { feature: "vibration_roc_smooth",     importance: 0.0319 },
  { feature: "rpm_roll144_mean",         importance: 0.0298 },
];
