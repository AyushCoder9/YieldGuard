"use client";

/**
 * DEMO PAGE — Completely isolated from real API.
 * All data sourced exclusively from ../../lib/demo-data
 * No crossover with real dashboard, API client, or production code.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, AreaChart, Area, BarChart, Bar, Cell
} from "recharts";
import {
  DEMO_MACHINES, DEMO_MODEL_METRICS, DEMO_TOP_FEATURES,
  type DemoMachine
} from "../../lib/demo-data";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { GaugeChart } from "../../components/ui/GaugeChart";

// ── Types ─────────────────────────────────────────────────────────────────────
type Channel = "vibration" | "temperature" | "pressure" | "current" | "rpm" | "acoustic";

const CHANNELS: { key: Channel; label: string; unit: string; color: string }[] = [
  { key: "vibration",   label: "Vibration",   unit: "mm/s", color: "#F0A500" },
  { key: "temperature", label: "Temperature", unit: "°C",   color: "#FF3B5C" },
  { key: "pressure",    label: "Pressure",    unit: "bar",  color: "#58A6FF" },
  { key: "current",     label: "Current",     unit: "A",    color: "#34D399" },
  { key: "rpm",         label: "RPM",         unit: "rpm",  color: "#A78BFA" },
  { key: "acoustic",    label: "Acoustic",    unit: "dB",   color: "#FB923C" },
];

const SPEEDS = [0.5, 1, 2, 5] as const;

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="hmi-panel px-3 py-2 text-xs shadow-xl">
      <div className="text-forge-muted font-barlow tracking-wider mb-1">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span style={{ color: p.color }} className="font-mono font-semibold">{typeof p.value === 'number' ? p.value.toFixed(3) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Risk probability area chart ───────────────────────────────────────────────
function RiskTimeline({ data, currentIdx }: { data: { t: string; fp: number }[]; currentIdx: number }) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="fpGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#FF3B5C" stopOpacity={0.4} />
            <stop offset="95%" stopColor="#FF3B5C" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <Area dataKey="fp" stroke="#FF3B5C" strokeWidth={1.5} fill="url(#fpGrad)" dot={false} />
        <ReferenceLine x={data[currentIdx]?.t} stroke="#F0A500" strokeWidth={1.5} strokeDasharray="4 2" />
        <YAxis domain={[0, 1]} hide />
        <XAxis dataKey="t" hide />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Feature importance bar chart ──────────────────────────────────────────────
function FeatureImportanceChart() {
  const top10 = DEMO_TOP_FEATURES.slice(0, 10);
  const max = top10[0].importance;
  return (
    <div className="space-y-2">
      {top10.map((f, i) => (
        <div key={f.feature} className="flex items-center gap-2">
          <span className="text-forge-muted font-mono text-[10px] w-4 text-right">{i + 1}</span>
          <div className="flex-1">
            <div className="flex justify-between mb-0.5">
              <span className="text-forge-text font-mono text-[11px] truncate pr-2">{f.feature}</span>
              <span className="text-forge-amber font-mono text-[11px] flex-shrink-0">{(f.importance * 100).toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-forge-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(f.importance / max) * 100}%`,
                  background: i < 3 ? "#F0A500" : i < 6 ? "#58A6FF" : "#00C896",
                  boxShadow: i < 3 ? "0 0 6px #F0A50080" : "none",
                }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sensor mini-chart ─────────────────────────────────────────────────────────
function SensorChart({
  machine, channel, windowStart, windowSize,
}: {
  machine: DemoMachine;
  channel: Channel;
  windowStart: number;
  windowSize: number;
}) {
  const ch = CHANNELS.find(c => c.key === channel)!;
  const raw = machine.series[channel] as number[];
  const fp  = machine.series.failureProbability;
  const ts  = machine.series.timestamps;

  const sliceEnd = Math.min(windowStart + windowSize, raw.length);
  const data = Array.from({ length: sliceEnd - windowStart }, (_, i) => {
    const idx = windowStart + i;
    return {
      t: ts[idx].slice(11, 16),
      v: raw[idx],
      fp: fp[idx],
    };
  });

  // Threshold line (simple: 1σ above mean)
  const mean = raw.slice(0, windowStart + 1).reduce((a, b) => a + b, 0) / (windowStart + 1 || 1);
  const std  = Math.sqrt(raw.slice(0, windowStart + 1).reduce((a, b) => a + (b - mean) ** 2, 0) / (windowStart + 1 || 1));
  const threshold = +(mean + 2 * std).toFixed(3);

  return (
    <div className="hmi-panel p-4 scanline">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: ch.color, boxShadow: `0 0 6px ${ch.color}` }} />
          <span className="font-barlow font-semibold tracking-wider uppercase text-xs" style={{ color: ch.color }}>
            {ch.label}
          </span>
          <span className="text-forge-muted text-xs">({ch.unit})</span>
        </div>
        <span className="sensor-val text-sm">{raw[windowStart + windowSize - 1]?.toFixed(3) ?? "—"}</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`sg-${channel}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={ch.color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={ch.color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#21262D" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#7D8590", fontFamily: "JetBrains Mono" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: "#7D8590", fontFamily: "JetBrains Mono" }} width={36} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={threshold} stroke="#F0A50060" strokeDasharray="4 2" label={{ value: "2σ", position: "right", fontSize: 9, fill: "#F0A500" }} />
          <Area dataKey="v" stroke={ch.color} strokeWidth={1.5} fill={`url(#sg-${channel})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Risk factor bar ───────────────────────────────────────────────────────────
function RiskFactor({ feature, importance, direction }: { feature: string; importance: number; direction: string }) {
  const dir = direction === "increasing" ? "↑" : direction === "decreasing" ? "↓" : "→";
  const color = direction === "increasing" ? "#FF3B5C" : direction === "decreasing" ? "#F0A500" : "#7D8590";
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-forge-border/40 last:border-0">
      <span className="text-xs font-mono flex-1 text-forge-text truncate">{feature}</span>
      <span className="text-xs font-semibold" style={{ color }}>{dir}</span>
      <div className="w-16 h-1.5 bg-forge-border rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${importance * 100 / 0.2}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-forge-muted w-8 text-right">{(importance * 100).toFixed(1)}%</span>
    </div>
  );
}

// ── Main demo page ────────────────────────────────────────────────────────────
export default function DemoPage() {
  const [selectedMachine, setSelectedMachine] = useState<DemoMachine>(DEMO_MACHINES[0]);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [activeChannel, setActiveChannel] = useState<Channel>("vibration");
  const [tab, setTab] = useState<"sensors" | "features" | "model">("sensors");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const seriesLen = selectedMachine.series.timestamps.length;
  const WINDOW = 72;

  // Advance playhead
  const tick = useCallback(() => {
    setPlayhead(p => {
      const next = p + 1;
      if (next >= seriesLen - WINDOW) { setIsPlaying(false); return p; }
      return next;
    });
  }, [seriesLen]);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(tick, 1000 / (speed * 4));
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, tick]);

  // Reset on machine change
  useEffect(() => {
    setPlayhead(0);
    setIsPlaying(false);
  }, [selectedMachine]);

  const windowStart = Math.max(0, playhead - WINDOW);
  const currentFp   = selectedMachine.series.failureProbability[playhead] ?? 0;
  const currentLabel = selectedMachine.series.labels[playhead] ?? 0;
  const riskStatus = currentFp > 0.75 ? "CRITICAL" : currentFp > 0.50 ? "HIGH" : currentFp > 0.20 ? "WARNING" : "OPERATIONAL";

  const fpTimeline = Array.from({ length: seriesLen }, (_, i) => ({
    t: selectedMachine.series.timestamps[i].slice(11, 16),
    fp: selectedMachine.series.failureProbability[i],
  }));

  return (
    <div className="min-h-screen bg-forge-black text-forge-text">
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-forge-border bg-forge-black/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5 text-forge-muted hover:text-forge-text transition-colors">
              <span className="text-xs">←</span>
              <span className="font-syne font-bold text-sm">YieldGuard</span>
            </Link>
            <span className="text-forge-border">|</span>
            <span className="font-barlow tracking-widest uppercase text-xs text-forge-amber">Interactive Demo</span>
            <span className="px-2 py-0.5 rounded-full bg-forge-amber/10 border border-forge-amber/30 text-forge-amber text-[10px] font-barlow tracking-widest uppercase">DEMO DATA ONLY</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-forge-muted">
            <span>T={playhead.toString().padStart(4, "0")}</span>
            <span className="text-forge-border">|</span>
            <span className={currentLabel === 2 ? "text-forge-red" : currentLabel === 1 ? "text-forge-amber" : "text-forge-green"}>
              {currentLabel === 2 ? "FAILURE IMMINENT" : currentLabel === 1 ? "DEGRADING" : "NOMINAL"}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex gap-4 h-[calc(100vh-3rem)]">
        {/* ── Left: Machine selector ──────────────────────────────── */}
        <aside className="w-52 flex-shrink-0 flex flex-col gap-2">
          <div className="text-forge-muted font-barlow tracking-widest uppercase text-[10px] px-1 mb-1">Fleet / 5 Machines</div>
          {DEMO_MACHINES.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMachine(m)}
              className={`hmi-panel p-3 text-left transition-all ${selectedMachine.id === m.id ? "border-forge-amber/60" : "hover:border-forge-border/80"}`}
              style={selectedMachine.id === m.id ? { boxShadow: "0 0 20px #F0A50020" } : {}}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono font-bold text-xs text-forge-amber">{m.id}</span>
                <StatusBadge status={m.currentStatus} pulse />
              </div>
              <div className="text-forge-muted text-[10px] font-dm leading-tight mb-2 truncate">{m.name}</div>
              <div className="flex items-center justify-between">
                <span className="text-forge-muted text-[10px] font-barlow tracking-wider">Risk</span>
                <span className={`font-mono font-bold text-sm ${m.failureProbability > 0.7 ? "text-forge-red" : m.failureProbability > 0.4 ? "text-forge-amber" : "text-forge-green"}`}>
                  {(m.failureProbability * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1.5 h-1 bg-forge-border rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${m.failureProbability * 100}%`,
                    background: m.failureProbability > 0.7 ? "#FF3B5C" : m.failureProbability > 0.4 ? "#F0A500" : "#00C896",
                  }}
                />
              </div>
            </button>
          ))}

          {/* Model metrics card */}
          <div className="hmi-panel p-3 mt-2">
            <div className="text-forge-muted font-barlow tracking-widest uppercase text-[10px] mb-2">Model</div>
            <div className="space-y-1.5 text-[11px]">
              {[
                { label: "XGB PR-AUC", val: DEMO_MODEL_METRICS.xgboost.prAuc, color: "text-forge-amber" },
                { label: "LGB PR-AUC", val: DEMO_MODEL_METRICS.lightgbm.prAuc, color: "text-forge-blue" },
                { label: "ROC-AUC",    val: DEMO_MODEL_METRICS.xgboost.rocAuc, color: "text-forge-green" },
              ].map(s => (
                <div key={s.label} className="flex justify-between">
                  <span className="text-forge-muted font-barlow tracking-wider">{s.label}</span>
                  <span className={`font-mono font-semibold ${s.color}`}>{s.val.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Center: Main visualization ──────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
          {/* Machine header */}
          <div className="hmi-panel p-4 flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-0.5">
                <span className="font-mono font-black text-forge-amber text-lg">{selectedMachine.id}</span>
                <StatusBadge status={riskStatus} pulse />
              </div>
              <div className="text-forge-text font-syne font-bold text-base">{selectedMachine.name}</div>
              <div className="text-forge-muted text-xs font-dm">{selectedMachine.type} · {selectedMachine.location} · {selectedMachine.age_years}y old</div>
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: "Vibration", val: selectedMachine.series.vibration[playhead]?.toFixed(2) + " mm/s", color: "#F0A500" },
                { label: "Temp",      val: selectedMachine.series.temperature[playhead]?.toFixed(1) + " °C",  color: "#FF3B5C" },
                { label: "RPM",       val: selectedMachine.series.rpm[playhead]?.toFixed(0),                   color: "#A78BFA" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="sensor-val text-base" style={{ color: s.color }}>{s.val}</div>
                  <div className="text-forge-muted text-[10px] font-barlow tracking-widest uppercase">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Risk timeline */}
          <div className="hmi-panel p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-forge-muted font-barlow tracking-widest uppercase text-[10px]">Failure Probability — 720 readings (5 days)</span>
              <span className={`font-mono font-bold text-sm ${currentFp > 0.75 ? "text-forge-red" : currentFp > 0.4 ? "text-forge-amber" : "text-forge-green"}`}>
                {(currentFp * 100).toFixed(1)}%
              </span>
            </div>
            <RiskTimeline data={fpTimeline} currentIdx={playhead} />
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 border-b border-forge-border">
            {(["sensors", "features", "model"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-barlow tracking-widest uppercase transition-all border-b-2 -mb-px ${tab === t ? "text-forge-amber border-forge-amber" : "text-forge-muted border-transparent hover:text-forge-text"}`}>
                {t === "sensors" ? "Sensor Channels" : t === "features" ? "Feature Importance" : "Model Metrics"}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "sensors" && (
            <div className="space-y-3">
              {/* Channel selector */}
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map(ch => (
                  <button key={ch.key} onClick={() => setActiveChannel(ch.key)}
                    className={`px-3 py-1 rounded-lg text-xs font-barlow tracking-wider uppercase transition-all border ${activeChannel === ch.key ? "border-current" : "border-forge-border text-forge-muted hover:border-forge-muted"}`}
                    style={activeChannel === ch.key ? { color: ch.color, borderColor: ch.color, background: `${ch.color}15` } : {}}>
                    {ch.label}
                  </button>
                ))}
              </div>
              <SensorChart machine={selectedMachine} channel={activeChannel} windowStart={windowStart} windowSize={WINDOW} />
              {/* Mini grid for other 3 channels */}
              <div className="grid grid-cols-2 gap-3">
                {CHANNELS.filter(c => c.key !== activeChannel).slice(0, 2).map(ch => (
                  <SensorChart key={ch.key} machine={selectedMachine} channel={ch.key} windowStart={windowStart} windowSize={Math.min(36, WINDOW)} />
                ))}
              </div>
            </div>
          )}

          {tab === "features" && (
            <div className="hmi-panel p-5">
              <div className="text-forge-text font-syne font-bold text-sm mb-4">Top 10 Predictive Features</div>
              <FeatureImportanceChart />
              <div className="mt-4 pt-4 border-t border-forge-border grid grid-cols-3 gap-4 text-center text-xs">
                <div>
                  <div className="font-syne font-bold text-forge-amber text-lg">256</div>
                  <div className="text-forge-muted font-barlow tracking-wider uppercase">Features Engineered</div>
                </div>
                <div>
                  <div className="font-syne font-bold text-forge-text text-lg">6</div>
                  <div className="text-forge-muted font-barlow tracking-wider uppercase">Sensor Channels</div>
                </div>
                <div>
                  <div className="font-syne font-bold text-forge-text text-lg">4</div>
                  <div className="text-forge-muted font-barlow tracking-wider uppercase">Window Sizes</div>
                </div>
              </div>
            </div>
          )}

          {tab === "model" && (
            <div className="grid grid-cols-2 gap-4">
              {(["xgboost", "lightgbm"] as const).map(m => {
                const met = DEMO_MODEL_METRICS[m];
                return (
                  <div key={m} className="hmi-panel p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-2 h-2 rounded-full ${m === "xgboost" ? "bg-forge-amber" : "bg-forge-blue"}`} />
                      <span className="font-syne font-bold text-forge-text">{m === "xgboost" ? "XGBoost" : "LightGBM"}</span>
                    </div>
                    <div className="space-y-3">
                      {[
                        { label: "PR-AUC",    val: met.prAuc,    note: "primary metric" },
                        { label: "ROC-AUC",   val: met.rocAuc,   note: "" },
                        { label: "F1 Score",  val: met.f1,       note: "" },
                        { label: "Recall",    val: met.recall,   note: "" },
                        { label: "Precision", val: met.precision, note: "" },
                        { label: "Threshold", val: met.threshold, note: "tuned" },
                      ].map(s => (
                        <div key={s.label} className="flex items-center justify-between">
                          <span className="text-forge-muted text-xs font-barlow tracking-wider">
                            {s.label}
                            {s.note && <span className="text-forge-subtle ml-1">({s.note})</span>}
                          </span>
                          <span className={`font-mono font-bold text-sm ${s.val > 0.8 ? "text-forge-green" : s.val > 0.6 ? "text-forge-amber" : "text-forge-text"}`}>
                            {s.val.toFixed(3)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              <div className="col-span-2 hmi-panel p-4">
                <div className="text-forge-muted font-barlow tracking-widest uppercase text-[10px] mb-3">Training Methodology</div>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  {[
                    { k: "CV Strategy",   v: "TimeSeriesExpandingCV" },
                    { k: "Folds",         v: "5 (pure time-based)" },
                    { k: "Gap",           v: "144 samples (24h)" },
                    { k: "HPO",           v: "Optuna TPE, 10 trials" },
                    { k: "Imbalance",     v: "scale_pos_weight ≈ 9.8" },
                    { k: "Objective",     v: "PR-AUC (not accuracy)" },
                  ].map(s => (
                    <div key={s.k}>
                      <div className="text-forge-muted font-barlow tracking-wider uppercase text-[10px] mb-0.5">{s.k}</div>
                      <div className="font-mono text-forge-text text-xs">{s.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>

        {/* ── Right: Risk panel ───────────────────────────────────── */}
        <aside className="w-56 flex-shrink-0 flex flex-col gap-3">
          {/* Gauge */}
          <div className="hmi-panel p-4 flex flex-col items-center">
            <div className="text-forge-muted font-barlow tracking-widest uppercase text-[10px] mb-3">Failure Risk</div>
            <GaugeChart value={currentFp} size={140} label={`${selectedMachine.id} · t=${playhead}`} />
            <div className="mt-3">
              <StatusBadge status={riskStatus} pulse />
            </div>
          </div>

          {/* Playback controls */}
          <div className="hmi-panel p-3">
            <div className="text-forge-muted font-barlow tracking-widest uppercase text-[10px] mb-3">Playback</div>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setPlayhead(0)}
                className="w-7 h-7 rounded border border-forge-border text-forge-muted hover:text-forge-text hover:border-forge-amber/40 transition-all text-xs font-mono flex items-center justify-center"
              >⏮</button>
              <button
                onClick={() => setIsPlaying(p => !p)}
                className={`flex-1 h-7 rounded border text-xs font-barlow tracking-wider uppercase transition-all ${isPlaying ? "border-forge-red/40 text-forge-red bg-forge-red/10" : "border-forge-green/40 text-forge-green bg-forge-green/10 hover:bg-forge-green/20"}`}
              >
                {isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
              </button>
            </div>
            {/* Speed */}
            <div className="text-forge-muted text-[10px] font-barlow tracking-wider mb-1.5">SPEED</div>
            <div className="grid grid-cols-4 gap-1">
              {SPEEDS.map(s => (
                <button key={s} onClick={() => setSpeed(s)}
                  className={`h-6 rounded text-[10px] font-mono transition-all border ${speed === s ? "border-forge-amber/60 text-forge-amber bg-forge-amber/10" : "border-forge-border text-forge-muted hover:border-forge-muted"}`}>
                  {s}×
                </button>
              ))}
            </div>
            {/* Scrubber */}
            <div className="mt-3">
              <div className="text-forge-muted text-[10px] font-barlow tracking-wider mb-1">POSITION</div>
              <input type="range" min={0} max={seriesLen - WINDOW - 1} value={playhead}
                onChange={e => { setIsPlaying(false); setPlayhead(+e.target.value); }}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{ accentColor: "#F0A500" }}
              />
              <div className="flex justify-between text-[9px] font-mono text-forge-muted mt-0.5">
                <span>0</span>
                <span>{playhead}</span>
                <span>{seriesLen - WINDOW - 1}</span>
              </div>
            </div>
          </div>

          {/* Top risk factors */}
          <div className="hmi-panel p-3 flex-1 overflow-y-auto">
            <div className="text-forge-muted font-barlow tracking-widest uppercase text-[10px] mb-2">Top Risk Factors</div>
            {selectedMachine.topRiskFactors.map(f => (
              <RiskFactor key={f.feature} {...f} />
            ))}
          </div>

          {/* Last reading */}
          <div className="hmi-panel p-3">
            <div className="text-forge-muted font-barlow tracking-widest uppercase text-[10px] mb-2">Current Reading</div>
            <div className="space-y-1">
              {CHANNELS.map(ch => (
                <div key={ch.key} className="flex justify-between">
                  <span className="text-forge-muted text-[10px] font-barlow tracking-wider">{ch.label}</span>
                  <span className="sensor-val text-[11px]" style={{ color: ch.color }}>
                    {(selectedMachine.series[ch.key] as number[])[playhead]?.toFixed(2)} {ch.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
