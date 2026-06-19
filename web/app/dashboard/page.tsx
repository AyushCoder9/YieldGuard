"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import Papa from "papaparse";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, ChevronDown, ChevronUp, Play, Download, AlertTriangle, Clock, X, Loader2, FileSpreadsheet, Sliders } from "lucide-react";
import { clsx } from "clsx";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { Tabs } from "../../components/ui/Tabs";
import { ResultPanel } from "../../components/ui/ResultPanel";
import { Tooltip } from "../../components/ui/Tooltip";
import { predict, synthesizeReadings, parseCSVToReadings, csvTemplate, type SliderValues, type PredictionResult } from "../../lib/engine/predict";
import { loadModel, type ModelSpec } from "../../lib/engine/model";
import type { FeatureSpec } from "../../lib/engine/explain";
import type { SensorReading } from "../../lib/engine/features";

/* ── Asset loader ──────────────────────────────────────────────────────────── */
async function loadEngineAssets(): Promise<{ model: ModelSpec; featureSpec: FeatureSpec } | null> {
  try {
    const [model, fsRes] = await Promise.all([
      loadModel(),
      fetch("/lib/engine/feature_spec.json"),
    ]);
    if (!fsRes.ok) throw new Error("feature_spec.json not found");
    const featureSpec = await fsRes.json() as FeatureSpec;
    return { model, featureSpec };
  } catch {
    return null;
  }
}

/* ── History entry ─────────────────────────────────────────────────────────── */
interface HistoryEntry {
  id: string;
  ts: string;
  inputType: "csv" | "sliders";
  rowCount: number;
  result: PredictionResult;
}

const HISTORY_KEY = "yieldguard-history";
const MAX_HISTORY = 5;

function loadHistory(): HistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"); }
  catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY))); }
  catch { /* ignore quota */ }
}

/* ── Sensor slider config ──────────────────────────────────────────────────── */
const SENSOR_SLIDERS: {
  key: keyof SliderValues;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultVal: number;
  color: string;
}[] = [
  { key: "vibration",   label: "Vibration",   unit: "mm/s", min: 0.5,   max: 15,   step: 0.1,   defaultVal: 2.5,  color: "#2DD4BF" },
  { key: "temperature", label: "Temperature", unit: "°C",   min: 40,    max: 120,  step: 0.5,   defaultVal: 65,   color: "#FB3B5C" },
  { key: "pressure",    label: "Pressure",    unit: "bar",  min: 2,     max: 15,   step: 0.1,   defaultVal: 8.0,  color: "#6366F1" },
  { key: "current",     label: "Current",     unit: "A",    min: 5,     max: 30,   step: 0.5,   defaultVal: 12.0, color: "#34D399" },
  { key: "rpm",         label: "RPM",         unit: "rpm",  min: 800,   max: 2000, step: 5,     defaultVal: 1475, color: "#A78BFA" },
  { key: "acoustic",    label: "Acoustic",    unit: "dB",   min: 55,    max: 110,  step: 0.5,   defaultVal: 72.0, color: "#FB923C" },
];

const DEFAULT_SLIDERS: SliderValues = {
  vibration: 2.5,
  temperature: 65,
  pressure: 8.0,
  current: 12.0,
  rpm: 1475,
  acoustic: 72.0,
  trend: "healthy",
};

/* ── Sensor input tab ──────────────────────────────────────────────────────── */
function SliderInput({ sliders, onChange }: {
  sliders: SliderValues;
  onChange: (s: SliderValues) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 mb-4">
        <Tooltip content="Set sensor values as if reading a machine right now. YieldGuard will simulate a 48-hour history from these baseline values and predict failure risk.">
          <span className="text-cc-muted text-xs cursor-help flex items-center gap-1 font-mono underline decoration-dotted underline-offset-2">
            How does this work?
          </span>
        </Tooltip>
        <button
          onClick={() => onChange(DEFAULT_SLIDERS)}
          className="text-[10px] font-mono text-cc-subtle hover:text-cc-muted transition-colors border border-cc-border/60 px-2 py-0.5 rounded cursor-pointer"
        >
          Reset defaults
        </button>
      </div>

      {SENSOR_SLIDERS.map(s => {
        const val = sliders[s.key] as number;
        const pct = ((val - s.min) / (s.max - s.min)) * 100;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <span className="w-28 text-xs font-mono text-cc-muted flex-shrink-0">
              {s.label}
            </span>
            <div className="flex-1 relative">
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={val}
                onChange={e => onChange({ ...sliders, [s.key]: +e.target.value })}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                aria-label={`${s.label} slider`}
                style={{ accentColor: s.color }}
              />
            </div>
            <span
              className="w-20 text-right font-mono text-sm font-semibold sensor-val flex-shrink-0"
              style={{ color: s.color }}
            >
              {val.toFixed(s.step < 1 ? 1 : 0)} {s.unit}
            </span>
          </div>
        );
      })}

      <div className="mt-5 pt-4 border-t border-cc-border">
        <div className="text-cc-muted text-[10px] font-semibold tracking-widest uppercase mb-2">
          Machine Trend
          <Tooltip content="Tell the model whether sensor values are stable (healthy), gradually worsening (degrading), or rapidly failing (critical). This shapes the synthetic time-history fed to the model.">
            <span className="ml-1 cursor-help text-cc-subtle text-[9px]">[?]</span>
          </Tooltip>
        </div>
        <div className="flex gap-2">
          {(["healthy", "degrading", "critical"] as const).map(t => (
            <button
              key={t}
              onClick={() => onChange({ ...sliders, trend: t })}
              className={clsx(
                "flex-1 py-1.5 rounded-lg text-[11px] font-mono font-medium capitalize border transition-all cursor-pointer",
                sliders.trend === t
                  ? t === "critical"  ? "border-cc-danger/50 text-cc-danger bg-cc-danger/10"
                  : t === "degrading" ? "border-cc-caution/50 text-cc-caution bg-cc-caution/10"
                                      : "border-cc-healthy/50 text-cc-healthy bg-cc-healthy/10"
                  : "border-cc-border text-cc-subtle hover:border-cc-border-strong"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── CSV upload panel ──────────────────────────────────────────────────────── */
function CSVUpload({ readings, errors, onParse, onClear }: {
  readings: SensorReading[];
  errors: string[];
  onParse: (rows: SensorReading[], errors: string[]) => void;
  onClear: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const parseErrors: string[] = results.errors.map(e => e.message);
        const parsed = parseCSVToReadings(results.data, parseErrors);
        onParse(parsed, parseErrors);
      },
    });
  }

  return (
    <div className="space-y-3">
      {/* Template download */}
      <div className="flex items-center justify-between">
        <span className="text-cc-muted text-xs">
          Need a template?{" "}
          <button
            onClick={() => {
              const blob = new Blob([csvTemplate()], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "yieldguard-template.csv"; a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-cc-healthy underline underline-offset-2 cursor-pointer font-mono text-xs"
          >
            Download sample CSV
          </button>
        </span>
        <span className="text-cc-subtle text-[10px] font-mono">Min 144 rows (24h)</span>
      </div>

      {/* Drop zone */}
      {readings.length === 0 ? (
        <div
          className={clsx(
            "drop-zone",
            dragging && "!border-cc-healthy !bg-cc-healthy/8"
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) processFile(file);
          }}
        >
          <Upload size={28} className={clsx("mx-auto mb-2", dragging ? "text-cc-healthy" : "text-cc-subtle")} />
          <div className="text-cc-text text-sm font-medium mb-0.5">
            Drop CSV file here or <span className="text-cc-healthy underline cursor-pointer">browse</span>
          </div>
          <div className="text-cc-subtle text-xs font-mono">
            Columns: timestamp · vibration_mm_s · temperature_c · pressure_bar · current_a · rpm · acoustic_db
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }}
          />
        </div>
      ) : (
        /* Preview */
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={14} className="text-cc-healthy" />
              <span className="text-cc-text text-xs font-semibold">{readings.length} readings loaded</span>
              {readings.length < 144 && (
                <span className="text-cc-danger text-[10px] font-mono">({144 - readings.length} more needed)</span>
              )}
            </div>
            <button
              onClick={onClear}
              className="text-cc-subtle hover:text-cc-muted transition-colors cursor-pointer"
              aria-label="Clear uploaded file"
            >
              <X size={13} />
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg">
            <table className="w-full text-[10px] font-mono">
              <thead>
                <tr className="border-b border-cc-border">
                  {["#", "Vibration", "Temp", "Pressure", "Current", "RPM", "Acoustic"].map(h => (
                    <th key={h} className="text-left px-2 py-1 text-cc-subtle font-semibold tracking-wide uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-b border-cc-border/30 last:border-0">
                    <td className="px-2 py-1 text-cc-subtle">{i + 1}</td>
                    <td className="px-2 py-1 text-cc-healthy">{r.vibration_mm_s.toFixed(3)}</td>
                    <td className="px-2 py-1 text-cc-danger">{r.temperature_c.toFixed(2)}</td>
                    <td className="px-2 py-1 text-cc-indigo">{r.pressure_bar.toFixed(3)}</td>
                    <td className="px-2 py-1 text-[#34D399]">{r.current_a.toFixed(3)}</td>
                    <td className="px-2 py-1 text-[#A78BFA]">{r.rpm.toFixed(1)}</td>
                    <td className="px-2 py-1 text-[#FB923C]">{r.acoustic_db.toFixed(2)}</td>
                  </tr>
                ))}
                {readings.length > 5 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-1 text-cc-subtle text-center">
                      ... {readings.length - 5} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Parse errors */}
      {errors.length > 0 && (
        <div className="glass rounded-xl p-3 border-cc-caution/20">
          <div className="flex items-center gap-1.5 text-cc-caution text-xs font-semibold mb-1">
            <AlertTriangle size={12} /> {errors.length} warning{errors.length > 1 ? "s" : ""}
          </div>
          <ul className="space-y-0.5">
            {errors.slice(0, 3).map((e, i) => (
              <li key={i} className="text-cc-muted text-[10px] font-mono">{e}</li>
            ))}
            {errors.length > 3 && <li className="text-cc-subtle text-[10px]">+{errors.length - 3} more</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── History panel ─────────────────────────────────────────────────────────── */
function HistoryPanel({ entries, onSelect, onClear }: {
  entries: HistoryEntry[];
  onSelect: (e: HistoryEntry) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 cursor-pointer"
      >
        <span className="flex items-center gap-2 text-xs font-mono text-cc-muted">
          <Clock size={12} /> Recent analyses ({entries.length})
        </span>
        {open ? <ChevronUp size={13} className="text-cc-subtle" /> : <ChevronDown size={13} className="text-cc-subtle" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-cc-border px-4 pb-3 pt-2 space-y-1">
              {entries.map(entry => {
                const fpPct = (entry.result.probability * 100).toFixed(0);
                const color = entry.result.probability > 0.75 ? "#FB3B5C"
                  : entry.result.probability > 0.40 ? "#F5A524" : "#2DD4BF";
                return (
                  <button
                    key={entry.id}
                    onClick={() => onSelect(entry)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-cc-raised transition-colors cursor-pointer text-left"
                  >
                    <span className="font-mono text-sm font-bold flex-shrink-0" style={{ color }}>
                      {fpPct}%
                    </span>
                    <span className="flex-1 text-cc-muted text-[11px] font-mono truncate">
                      {entry.inputType === "csv" ? `CSV · ${entry.rowCount} rows` : "Quick Try"}
                    </span>
                    <span className="text-cc-subtle text-[9px] font-mono flex-shrink-0">
                      {new Date(entry.ts).toLocaleTimeString()}
                    </span>
                  </button>
                );
              })}
              <button
                onClick={onClear}
                className="text-cc-subtle text-[10px] font-mono hover:text-cc-muted transition-colors cursor-pointer mt-1"
              >
                Clear history
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── No model banner ─────────────────────────────────────────────────────── */
function NoModelBanner() {
  return (
    <GlassPanel className="border-cc-caution/20" padding="p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={16} className="text-cc-caution flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-display font-semibold text-cc-text text-sm mb-1">Model not yet available</div>
          <p className="text-cc-muted text-xs leading-relaxed">
            The ML model (<code className="font-mono text-cc-text">model.json</code>) hasn't been exported yet. Run the Python training pipeline first:
          </p>
          <pre className="bg-cc-raised rounded-lg px-3 py-2 text-[10px] font-mono text-cc-text mt-2 overflow-x-auto">
{`make pipeline
python scripts/export_model.py`}
          </pre>
          <p className="text-cc-muted text-[10px] mt-2">
            Meanwhile, try the{" "}
            <Link href="/demo" className="text-cc-healthy underline underline-offset-2">
              interactive demo →
            </Link>
          </p>
        </div>
      </div>
    </GlassPanel>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────────── */
const INPUT_TABS = [
  { id: "sliders" as const, label: "Quick Try", icon: <Sliders size={12} /> },
  { id: "csv"     as const, label: "Upload CSV", icon: <Upload   size={12} /> },
];

export default function DashboardPage() {
  const [inputTab, setInputTab]       = useState<"sliders" | "csv">("sliders");
  const [sliders, setSliders]         = useState<SliderValues>(DEFAULT_SLIDERS);
  const [csvReadings, setCsvReadings] = useState<SensorReading[]>([]);
  const [csvErrors, setCsvErrors]     = useState<string[]>([]);
  const [engineState, setEngineState] = useState<
    "idle" | "loading" | "ready" | "error" | "running"
  >("idle");
  const [assets, setAssets]           = useState<{ model: ModelSpec; featureSpec: FeatureSpec } | null>(null);
  const [result, setResult]           = useState<PredictionResult | null>(null);
  const [history, setHistory]         = useState<HistoryEntry[]>([]);

  /* load engine once on mount */
  useEffect(() => {
    setEngineState("loading");
    loadEngineAssets().then(a => {
      if (a) { setAssets(a); setEngineState("ready"); }
      else { setEngineState("error"); }
    });
    setHistory(loadHistory());
  }, []);

  const canRun = useCallback(() => {
    if (engineState !== "ready") return false;
    if (inputTab === "csv") return csvReadings.length >= 144;
    return true;
  }, [engineState, inputTab, csvReadings.length]);

  async function runAnalysis() {
    if (!assets || engineState !== "ready") return;
    setEngineState("running");
    setResult(null);

    try {
      const readings = inputTab === "sliders"
        ? synthesizeReadings(sliders, 288)
        : csvReadings;

      await new Promise(r => setTimeout(r, 120)); // let UI update before sync compute

      const res = predict(readings, assets.model, assets.featureSpec);
      setResult(res);
      setEngineState("ready");

      const entry: HistoryEntry = {
        id: Date.now().toString(),
        ts: new Date().toISOString(),
        inputType: inputTab,
        rowCount: readings.length,
        result: res,
      };
      const next = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(next);
      saveHistory(next);
    } catch (err) {
      console.error(err);
      setEngineState("ready");
    }
  }

  const activeReadings = inputTab === "sliders"
    ? synthesizeReadings(sliders, 288)
    : csvReadings;

  return (
    <div className="min-h-dvh bg-cc-bg text-cc-text flex flex-col">
      <Navbar />

      <div className="mt-[60px] border-b border-cc-border bg-cc-surface/60 backdrop-blur-sm sticky top-[60px] z-30">
        <div className="max-w-screen-xl mx-auto px-4 h-10 flex items-center justify-between">
          <span className="text-cc-muted text-xs font-mono">
            Predictions run in-browser · No data leaves your device
          </span>
          <Link href="/demo" className="text-cc-muted hover:text-cc-text text-[11px] font-mono transition-colors">
            Explore demo →
          </Link>
        </div>
      </div>

      <div className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="font-display font-bold text-2xl text-cc-text mb-1">
              Machine Health Analysis
            </h1>
            <p className="text-cc-muted text-sm">
              Upload your sensor data or dial in values manually — the model runs instantly in your browser.
            </p>
          </motion.div>

          {engineState === "error" && <NoModelBanner />}

          {engineState !== "error" && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              {/* ── Left: input ─────────────────────────────────────────────── */}
              <div className="space-y-4">
                <GlassPanel padding="p-5">
                  <Tabs tabs={INPUT_TABS} active={inputTab} onChange={(id) => setInputTab(id as "sliders" | "csv")} variant="pill" />

                  <div className="mt-4">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={inputTab}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                      >
                        {inputTab === "sliders" ? (
                          <SliderInput sliders={sliders} onChange={setSliders} />
                        ) : (
                          <CSVUpload
                            readings={csvReadings}
                            errors={csvErrors}
                            onParse={(rows, errs) => { setCsvReadings(rows); setCsvErrors(errs); }}
                            onClear={() => { setCsvReadings([]); setCsvErrors([]); }}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Run button */}
                  <div className="mt-5 pt-4 border-t border-cc-border flex flex-wrap items-center gap-3">
                    <button
                      onClick={runAnalysis}
                      disabled={!canRun() || engineState === "running"}
                      className={clsx(
                        "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-display font-semibold transition-all cursor-pointer",
                        canRun() && engineState !== "running"
                          ? "bg-signal-gradient text-cc-ink hover:opacity-90 active:scale-[0.98]"
                          : "bg-cc-raised text-cc-subtle cursor-not-allowed"
                      )}
                    >
                      {engineState === "running" ? (
                        <><Loader2 size={15} className="animate-spin" /> Analyzing…</>
                      ) : engineState === "loading" ? (
                        <><Loader2 size={15} className="animate-spin" /> Loading model…</>
                      ) : (
                        <><Play size={15} /> Run Analysis</>
                      )}
                    </button>

                    {inputTab === "csv" && csvReadings.length > 0 && csvReadings.length < 144 && (
                      <span className="text-cc-caution text-[11px] font-mono">
                        Need {144 - csvReadings.length} more rows
                      </span>
                    )}

                    {inputTab === "csv" && csvReadings.length === 0 && (
                      <span className="text-cc-subtle text-[11px] font-mono">Upload a CSV first</span>
                    )}

                    {engineState === "loading" && (
                      <span className="text-cc-subtle text-[11px] font-mono">Loading model…</span>
                    )}
                  </div>
                </GlassPanel>

                {/* History */}
                <HistoryPanel
                  entries={history}
                  onSelect={e => setResult(e.result)}
                  onClear={() => { setHistory([]); saveHistory([]); }}
                />
              </div>

              {/* ── Right: result ─────────────────────────────────────────── */}
              <div>
                <AnimatePresence mode="wait">
                  {engineState === "running" && (
                    <motion.div
                      key="running"
                      className="glass rounded-2xl p-10 flex flex-col items-center justify-center gap-4"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    >
                      <div className="relative w-14 h-14">
                        <div className="absolute inset-0 rounded-full border-2 border-cc-healthy/20" />
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cc-healthy animate-spin" />
                      </div>
                      <div className="text-cc-muted text-sm font-mono text-center">
                        Computing 250+ features<br />
                        <span className="text-cc-subtle text-[11px]">Running tree ensemble…</span>
                      </div>
                    </motion.div>
                  )}

                  {!result && engineState !== "running" && (
                    <motion.div
                      key="empty"
                      className="glass rounded-2xl p-8 flex flex-col items-center justify-center gap-4 text-center"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ minHeight: 280 }}
                    >
                      <div className="w-12 h-12 rounded-full bg-cc-surface-2 flex items-center justify-center">
                        <Play size={20} className="text-cc-subtle ml-0.5" />
                      </div>
                      <div>
                        <div className="font-display font-semibold text-cc-text text-sm mb-1">
                          Ready to analyze
                        </div>
                        <p className="text-cc-muted text-xs leading-relaxed max-w-xs mx-auto">
                          {inputTab === "sliders"
                            ? "Set the slider values to match your machine's current readings, then hit Run."
                            : "Upload a CSV with at least 144 rows (24 hours at 10-minute intervals), then hit Run."}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center text-[10px] font-mono text-cc-subtle">
                        <span className="px-2 py-0.5 glass rounded-full">256 features</span>
                        <span className="px-2 py-0.5 glass rounded-full">in-browser</span>
                        <span className="px-2 py-0.5 glass rounded-full">instant</span>
                      </div>
                    </motion.div>
                  )}

                  {result && engineState !== "running" && (
                    <ResultPanel
                      key="result"
                      result={result}
                      readings={activeReadings}
                      onReset={() => setResult(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
