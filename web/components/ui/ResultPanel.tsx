"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus, Download, RotateCcw, HelpCircle } from "lucide-react";
import { clsx } from "clsx";
import { RiskMeter } from "./RiskMeter";
import { SensorChart } from "./SensorChart";
import { GlassPanel } from "./GlassPanel";
import { Tooltip } from "./Tooltip";
import type { PredictionResult } from "../../lib/engine/predict";
import type { SensorReading } from "../../lib/engine/features";

interface ResultPanelProps {
  result: PredictionResult;
  readings: SensorReading[];
  onReset?: () => void;
  className?: string;
}

const SENSOR_META = [
  { key: "vibration_mm_s" as keyof SensorReading, label: "Vibration",   unit: "mm/s",  color: "#2DD4BF" },
  { key: "temperature_c"  as keyof SensorReading, label: "Temperature", unit: "°C",    color: "#FB3B5C" },
  { key: "pressure_bar"   as keyof SensorReading, label: "Pressure",    unit: "bar",   color: "#6366F1" },
  { key: "current_a"      as keyof SensorReading, label: "Current",     unit: "A",     color: "#34D399" },
  { key: "rpm"            as keyof SensorReading, label: "RPM",         unit: "rpm",   color: "#A78BFA" },
  { key: "acoustic_db"    as keyof SensorReading, label: "Acoustic",    unit: "dB",    color: "#FB923C" },
];

const URGENCY_CLASSES = {
  critical: "border-cc-danger/30 bg-cc-danger/5",
  high:     "border-cc-caution/30 bg-cc-caution/5",
  medium:   "border-cc-caution/20 bg-cc-caution/4",
  low:      "border-cc-healthy/20 bg-cc-healthy/5",
};

const URGENCY_ICONS = {
  critical: <AlertTriangle size={16} className="text-cc-danger flex-shrink-0" />,
  high:     <AlertTriangle size={16} className="text-cc-caution flex-shrink-0" />,
  medium:   <AlertTriangle size={16} className="text-cc-caution flex-shrink-0" />,
  low:      <CheckCircle2 size={16} className="text-cc-healthy flex-shrink-0" />,
};

function DirectionIcon({ dir }: { dir: string }) {
  if (dir === "increasing") return <TrendingUp size={13} className="text-cc-danger" />;
  if (dir === "decreasing") return <TrendingDown size={13} className="text-cc-caution" />;
  return <Minus size={13} className="text-cc-subtle" />;
}

export function ResultPanel({ result, readings, onReset, className }: ResultPanelProps) {
  const { probability, riskLevel, drivers, recommendation } = result;

  const sliceLen = Math.min(readings.length, 144);
  const sliced = readings.slice(-sliceLen);
  const chartData = sliced.map((r, i) => ({ t: `${i * 10}m`, v: 0, ...r }));

  function exportCSV() {
    const header = "timestamp,vibration_mm_s,temperature_c,pressure_bar,current_a,rpm,acoustic_db,failure_probability";
    const rows = readings.map((r, i) => [
      new Date(Date.now() - (readings.length - 1 - i) * 600_000).toISOString(),
      r.vibration_mm_s.toFixed(4),
      r.temperature_c.toFixed(4),
      r.pressure_bar.toFixed(4),
      r.current_a.toFixed(4),
      r.rpm.toFixed(2),
      r.acoustic_db.toFixed(4),
      i === readings.length - 1 ? probability.toFixed(4) : "",
    ].join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yieldguard-analysis-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AnimatePresence>
      <motion.div
        className={clsx("space-y-5", className)}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* ── Risk gauge ─────────────────────────────────────────────── */}
        <GlassPanel className="flex flex-col items-center py-8">
          <div className="text-cc-muted text-xs font-semibold tracking-widest uppercase mb-6">
            24-Hour Failure Risk
            <Tooltip content="Probability that this machine will fail within the next 24 hours, based on the sensor pattern we analyzed." side="right">
              <span className="ml-1.5 cursor-help text-cc-subtle inline-flex items-center"><HelpCircle size={12} /></span>
            </Tooltip>
          </div>
          <RiskMeter
            probability={probability}
            riskLevel={riskLevel}
            size="lg"
          />
        </GlassPanel>

        {/* ── Recommendation ─────────────────────────────────────────── */}
        <div className={clsx(
          "rounded-xl border p-4 flex gap-3",
          URGENCY_CLASSES[recommendation.urgency]
        )}>
          {URGENCY_ICONS[recommendation.urgency]}
          <div>
            <div className="font-display font-semibold text-cc-text text-[14px] mb-0.5">
              {recommendation.title}
            </div>
            <p className="text-cc-muted text-sm leading-relaxed">{recommendation.body}</p>
          </div>
        </div>

        {/* ── Risk drivers ───────────────────────────────────────────── */}
        {drivers.length > 0 && (
          <GlassPanel padding="p-4">
            <div className="flex items-center gap-1.5 mb-3">
              <span className="text-cc-muted text-xs font-semibold tracking-widest uppercase">
                Top Risk Factors
              </span>
              <Tooltip content="The sensor measurements contributing most to this prediction, ranked by their deviation from healthy baseline × overall feature importance.">
                <span className="cursor-help text-cc-subtle inline-flex items-center"><HelpCircle size={11} /></span>
              </Tooltip>
            </div>
            <div className="space-y-1.5">
              {drivers.map((d) => {
                const barW = Math.min(100, Math.abs(d.deviation) * 15);
                const barColor = d.direction === "increasing" ? "#FB3B5C"
                  : d.direction === "decreasing" ? "#F5A524"
                  : "#93A1B0";
                return (
                  <div key={d.feature} className="flex items-center gap-2.5 py-1.5 border-b border-cc-border/40 last:border-0">
                    <DirectionIcon dir={d.direction} />
                    <span className="flex-1 text-xs font-mono text-cc-text truncate">{d.label}</span>
                    <div className="w-16 h-1.5 bg-cc-raised rounded-full overflow-hidden flex-shrink-0">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: barColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${barW}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-cc-muted w-8 text-right flex-shrink-0">
                      {(d.importance * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassPanel>
        )}

        {/* ── Sensor charts ──────────────────────────────────────────── */}
        <div>
          <div className="text-cc-muted text-xs font-semibold tracking-widest uppercase mb-3">
            Analyzed Sensor Window ({sliceLen} readings, {Math.round(sliceLen * 10 / 60)}h)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SENSOR_META.map(({ key, label, unit, color }) => (
              <SensorChart
                key={key}
                data={chartData.map(r => ({ t: r.t, v: r[key] as number }))}
                color={color}
                label={label}
                unit={unit}
                height={90}
              />
            ))}
          </div>
        </div>

        {/* ── Explainer collapse ─────────────────────────────────────── */}
        <GlassPanel padding="p-4">
          <div className="text-cc-muted text-xs font-semibold tracking-widest uppercase mb-2">
            What does this mean?
          </div>
          <p className="text-cc-muted text-sm leading-relaxed">
            YieldGuard analyzed <strong className="text-cc-text">{readings.length} sensor readings</strong> (one every 10 minutes) from 6 measurement channels.
            It computed <strong className="text-cc-text">250+ statistical features</strong> — rolling averages, trend rates, frequency signatures — and ran them through a machine learning model trained on thousands of real failure patterns.
          </p>
          <p className="text-cc-muted text-sm leading-relaxed mt-2">
            A probability of <strong className="text-cc-text">{Math.round(probability * 100)}%</strong> means the model estimates this machine has a {Math.round(probability * 100)}% chance of failing in the next 24 hours based on the detected pattern.
          </p>
        </GlassPanel>

        {/* ── Actions ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg text-xs text-cc-muted hover:text-cc-text transition-colors cursor-pointer"
          >
            <Download size={13} /> Export CSV
          </button>
          {onReset && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 glass rounded-lg text-xs text-cc-muted hover:text-cc-text transition-colors cursor-pointer"
            >
              <RotateCcw size={13} /> New Analysis
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
