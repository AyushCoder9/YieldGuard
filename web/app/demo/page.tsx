"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, SkipBack, ChevronRight, Info, Upload, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { clsx } from "clsx";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { Gauge } from "../../components/ui/Gauge";
import { RiskBadge } from "../../components/ui/Badge";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { SensorChart, RiskTimeline } from "../../components/ui/SensorChart";
import { Tabs } from "../../components/ui/Tabs";
import { Tooltip } from "../../components/ui/Tooltip";
import { DEMO_MACHINES, DEMO_MODEL_METRICS, DEMO_TOP_FEATURES, type DemoMachine } from "../../lib/demo-data";

type Channel = "vibration" | "temperature" | "pressure" | "current" | "rpm" | "acoustic";

const CHANNELS: { key: Channel; label: string; unit: string; color: string; sensorKey: keyof DemoMachine["series"] }[] = [
  { key: "vibration",   label: "Vibration",   unit: "mm/s", color: "#2DD4BF", sensorKey: "vibration" },
  { key: "temperature", label: "Temperature", unit: "°C",   color: "#FB3B5C", sensorKey: "temperature" },
  { key: "pressure",    label: "Pressure",    unit: "bar",  color: "#6366F1", sensorKey: "pressure" },
  { key: "current",     label: "Current",     unit: "A",    color: "#34D399", sensorKey: "current" },
  { key: "rpm",         label: "RPM",         unit: "rpm",  color: "#A78BFA", sensorKey: "rpm" },
  { key: "acoustic",    label: "Acoustic",    unit: "dB",   color: "#FB923C", sensorKey: "acoustic" },
];

const SPEEDS = [0.5, 1, 2, 5] as const;
const WINDOW = 72;

const TABS = [
  { id: "sensors" as const,  label: "Sensors" },
  { id: "features" as const, label: "Feature Importance" },
  { id: "model" as const,    label: "Model Info" },
];

function FeatureBar({ feature, importance, rank }: { feature: string; importance: number; rank: number }) {
  const maxImp = DEMO_TOP_FEATURES[0].importance;
  const color = rank === 0 ? "#2DD4BF" : rank < 4 ? "#6366F1" : "#93A1B0";
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="text-cc-subtle font-mono text-[10px] w-4 text-right flex-shrink-0">{rank + 1}</span>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          <span className="text-cc-text font-mono text-[11px] truncate pr-2">{feature}</span>
          <span className="font-mono text-[11px] flex-shrink-0" style={{ color }}>
            {(importance * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-1 bg-cc-raised rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            initial={{ width: 0 }}
            animate={{ width: `${(importance / maxImp) * 100}%` }}
            transition={{ duration: 0.6, delay: rank * 0.03, ease: "easeOut" }}
          />
        </div>
      </div>
    </div>
  );
}

function MachineCard({ machine, selected, onClick }: {
  machine: DemoMachine;
  selected: boolean;
  onClick: () => void;
}) {
  const riskColor = machine.failureProbability > 0.7 ? "#FB3B5C"
    : machine.failureProbability > 0.4 ? "#F5A524"
    : "#2DD4BF";

  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full text-left glass rounded-xl p-3 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-healthy",
        selected
          ? "border-cc-healthy/40 shadow-healthy-glow"
          : "hover:border-cc-border-strong"
      )}
      aria-pressed={selected}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono font-bold text-xs" style={{ color: selected ? "#2DD4BF" : "#E6EDF3" }}>
          {machine.id}
        </span>
        <RiskBadge level={machine.currentStatus} />
      </div>
      <div className="text-cc-muted text-[11px] font-sans mb-2 truncate">{machine.name}</div>
      <div className="flex items-center justify-between">
        <span className="text-cc-subtle text-[10px] font-mono">Risk</span>
        <span className="font-mono font-bold text-sm" style={{ color: riskColor }}>
          {(machine.failureProbability * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-1.5 h-1 bg-cc-raised rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${machine.failureProbability * 100}%`,
            background: riskColor,
            boxShadow: selected ? `0 0 6px ${riskColor}60` : "none",
          }}
        />
      </div>
    </button>
  );
}

function CurrentReadings({ machine, playhead }: { machine: DemoMachine; playhead: number }) {
  return (
    <GlassPanel padding="p-3">
      <div className="text-cc-muted text-[10px] font-semibold tracking-widest uppercase mb-2">Live Reading</div>
      <div className="space-y-1.5">
        {CHANNELS.map(ch => {
          const val = (machine.series[ch.sensorKey] as number[])[playhead];
          return (
            <div key={ch.key} className="flex justify-between items-center">
              <span className="text-cc-subtle text-[10px] font-sans">{ch.label}</span>
              <span className="font-mono text-[11px] font-medium sensor-val" style={{ color: ch.color }}>
                {val?.toFixed(2)} {ch.unit}
              </span>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}

export default function DemoPage() {
  const [selectedMachine, setSelectedMachine] = useState<DemoMachine>(DEMO_MACHINES[0]);
  const [playhead, setPlayhead] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [activeChannel, setActiveChannel] = useState<Channel>("vibration");
  const [tab, setTab] = useState<"sensors" | "features" | "model">("sensors");
  const [showCoachmark, setShowCoachmark] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seriesLen = selectedMachine.series.timestamps.length;

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
      setShowCoachmark(false);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, speed, tick]);

  useEffect(() => { setPlayhead(0); setIsPlaying(false); }, [selectedMachine]);

  const windowStart = Math.max(0, playhead - WINDOW);
  const currentFp = selectedMachine.series.failureProbability[playhead] ?? 0;
  const currentLabel = selectedMachine.series.labels[playhead] ?? 0;

  const riskLevel = currentFp > 0.75 ? "CRITICAL"
    : currentFp > 0.50 ? "HIGH"
    : currentFp > 0.20 ? "MEDIUM"
    : "OPERATIONAL";

  const fpTimeline = useMemo(() => selectedMachine.series.timestamps.map((_, i) => ({
    t: selectedMachine.series.timestamps[i].slice(11, 16),
    fp: selectedMachine.series.failureProbability[i],
  })), [selectedMachine]);

  const chartData = useMemo(() => {
    const slice = CHANNELS.map(ch => ({
      key: ch.key,
      data: (selectedMachine.series[ch.sensorKey] as number[])
        .slice(windowStart, windowStart + WINDOW)
        .map((v, i) => ({
          t: selectedMachine.series.timestamps[windowStart + i].slice(11, 16),
          v,
        })),
    }));
    return Object.fromEntries(slice.map(s => [s.key, s.data]));
  }, [selectedMachine, windowStart]);

  return (
    <div className="min-h-dvh bg-cc-bg text-cc-text flex flex-col">
      <Navbar />

      {/* ── Demo banner ───────────────────────────────────────────────────── */}
      <div className="mt-[60px] border-b border-cc-border bg-cc-surface/60 backdrop-blur-sm sticky top-[60px] z-30">
        <div className="max-w-screen-2xl mx-auto px-4 h-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="badge-caution px-2 py-0.5 rounded-full text-[10px] font-mono font-medium tracking-widest">
              DEMO DATA
            </span>
            <span className="text-cc-muted text-xs font-mono">
              T={playhead.toString().padStart(4, "0")}
            </span>
            <span className={clsx(
              "text-xs font-mono font-semibold",
              currentLabel === 2 ? "text-cc-danger" :
              currentLabel === 1 ? "text-cc-caution" : "text-cc-healthy"
            )}>
              {currentLabel === 2 ? "FAILURE IMMINENT" : currentLabel === 1 ? "DEGRADING" : "NOMINAL"}
            </span>
          </div>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-cc-muted hover:text-cc-text text-xs transition-colors font-mono"
          >
            Use your own data <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── Coachmark overlay ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCoachmark && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-cc-bg/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCoachmark(false)}
          >
            <motion.div
              className="glass rounded-2xl p-8 max-w-sm mx-4 text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="text-4xl mb-4">🏭</div>
              <h2 className="font-display font-bold text-cc-text text-lg mb-2">Try the live demo</h2>
              <p className="text-cc-muted text-sm leading-relaxed mb-6">
                Pick a machine from the left panel, then press <strong className="text-cc-text">Play</strong> to watch sensor readings evolve and the risk gauge respond in real time.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => { setShowCoachmark(false); setIsPlaying(true); }}
                  className="w-full px-5 py-2.5 rounded-xl text-sm font-display font-semibold bg-signal-gradient text-cc-ink"
                >
                  Start Demo
                </button>
                <button
                  onClick={() => setShowCoachmark(false)}
                  className="text-cc-muted text-sm hover:text-cc-text transition-colors"
                >
                  Explore freely
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main layout ───────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-4 flex gap-4" style={{ minHeight: "calc(100dvh - 100px)" }}>

        {/* ── Left: fleet + model sidebar ───────────────────────────────── */}
        <aside className="w-52 flex-shrink-0 flex flex-col gap-2 overflow-y-auto">
          <div className="text-cc-subtle text-[10px] font-semibold tracking-widest uppercase px-1 mb-1">
            Demo Fleet · 5 Machines
          </div>

          {DEMO_MACHINES.map(m => (
            <MachineCard
              key={m.id}
              machine={m}
              selected={selectedMachine.id === m.id}
              onClick={() => setSelectedMachine(m)}
            />
          ))}

          {/* Model metrics */}
          <GlassPanel padding="p-3" className="mt-2">
            <div className="text-cc-muted text-[10px] font-semibold tracking-widest uppercase mb-2">Model</div>
            <div className="space-y-1.5 text-[11px]">
              {[
                { label: "LGB PR-AUC",  val: DEMO_MODEL_METRICS.lightgbm.prAuc, color: "#2DD4BF" },
                { label: "XGB PR-AUC",  val: DEMO_MODEL_METRICS.xgboost.prAuc,  color: "#6366F1" },
                { label: "ROC-AUC",     val: DEMO_MODEL_METRICS.xgboost.rocAuc, color: "#34D399" },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center">
                  <span className="text-cc-subtle font-mono">{s.label}</span>
                  <span className="font-mono font-semibold" style={{ color: s.color }}>{s.val.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </aside>

        {/* ── Center: main viz ──────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
          {/* Machine header */}
          <GlassPanel padding="p-4" className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-0.5">
                <span className="font-mono font-bold text-cc-healthy text-lg">{selectedMachine.id}</span>
                <RiskBadge level={riskLevel} pulse={riskLevel === "CRITICAL" || riskLevel === "HIGH"} />
              </div>
              <div className="font-display font-semibold text-cc-text">{selectedMachine.name}</div>
              <div className="text-cc-muted text-xs font-sans mt-0.5">
                {selectedMachine.type} · {selectedMachine.location} · {selectedMachine.age_years}y old
              </div>
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: "Vibration", val: selectedMachine.series.vibration[playhead]?.toFixed(2), unit: "mm/s", color: "#2DD4BF" },
                { label: "Temp",      val: selectedMachine.series.temperature[playhead]?.toFixed(1), unit: "°C",   color: "#FB3B5C" },
                { label: "RPM",       val: selectedMachine.series.rpm[playhead]?.toFixed(0),          unit: "rpm",  color: "#A78BFA" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="font-mono text-base font-semibold sensor-val" style={{ color: s.color }}>
                    {s.val} {s.unit}
                  </div>
                  <div className="text-cc-subtle text-[10px] font-mono tracking-wide uppercase">{s.label}</div>
                </div>
              ))}
            </div>
          </GlassPanel>

          {/* Risk timeline */}
          <GlassPanel padding="p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-cc-muted text-[10px] font-semibold tracking-widest uppercase">
                  Failure Probability — 720 readings (5 days)
                </span>
                <Tooltip content="The orange line shows the machine's predicted failure probability across the full demo window. The dashed vertical line is your current position.">
                  <span className="cursor-help text-cc-subtle"><Info size={11} /></span>
                </Tooltip>
              </div>
              <span className={clsx("font-mono font-bold text-sm",
                currentFp > 0.75 ? "text-cc-danger" : currentFp > 0.4 ? "text-cc-caution" : "text-cc-healthy"
              )}>
                {(currentFp * 100).toFixed(1)}%
              </span>
            </div>
            <RiskTimeline data={fpTimeline} currentIdx={playhead} height={72} />
          </GlassPanel>

          {/* Tabs */}
          <Tabs tabs={TABS} active={tab} onChange={(id) => setTab(id as "sensors" | "features" | "model")} />

          {/* Tab content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "sensors" && (
                <div className="space-y-3">
                  {/* Channel picker */}
                  <div className="flex flex-wrap gap-1.5">
                    {CHANNELS.map(ch => (
                      <button
                        key={ch.key}
                        onClick={() => setActiveChannel(ch.key)}
                        className={clsx(
                          "px-2.5 py-1 rounded-lg text-[11px] font-mono tracking-wide uppercase transition-all border cursor-pointer",
                          activeChannel === ch.key
                            ? "border-current"
                            : "border-cc-border text-cc-muted hover:border-cc-border-strong"
                        )}
                        style={activeChannel === ch.key ? { color: ch.color, borderColor: ch.color, background: `${ch.color}12` } : {}}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>

                  {/* Primary chart */}
                  {(() => {
                    const ch = CHANNELS.find(c => c.key === activeChannel)!;
                    const data = (chartData[activeChannel] ?? []) as { t: string; v: number }[];
                    const arr = (selectedMachine.series[ch.sensorKey] as number[]).slice(0, windowStart + 1);
                    const mean = arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
                    const std = Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / (arr.length || 1));
                    return (
                      <SensorChart
                        data={data}
                        color={ch.color}
                        label={ch.label}
                        unit={ch.unit}
                        threshold={+(mean + 2 * std).toFixed(3)}
                        height={140}
                      />
                    );
                  })()}

                  {/* Mini grid — other channels */}
                  <div className="grid grid-cols-2 gap-3">
                    {CHANNELS.filter(c => c.key !== activeChannel).slice(0, 4).map(ch => (
                      <SensorChart
                        key={ch.key}
                        data={(chartData[ch.key] ?? []) as { t: string; v: number }[]}
                        color={ch.color}
                        label={ch.label}
                        unit={ch.unit}
                        height={80}
                      />
                    ))}
                  </div>
                </div>
              )}

              {tab === "features" && (
                <GlassPanel padding="p-5">
                  <div className="font-display font-semibold text-cc-text mb-4">Top 15 Predictive Features</div>
                  <div className="space-y-0.5">
                    {DEMO_TOP_FEATURES.map((f, i) => (
                      <FeatureBar key={f.feature} feature={f.feature} importance={f.importance} rank={i} />
                    ))}
                  </div>
                  <div className="mt-5 pt-4 border-t border-cc-border grid grid-cols-3 gap-4 text-center">
                    {[
                      { val: "256", label: "Features engineered" },
                      { val: "6",   label: "Sensor channels" },
                      { val: "4",   label: "Window sizes" },
                    ].map(s => (
                      <div key={s.label}>
                        <div className="font-display font-bold text-cc-healthy text-xl">{s.val}</div>
                        <div className="text-cc-muted text-[10px] font-mono tracking-wide uppercase mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>
                </GlassPanel>
              )}

              {tab === "model" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(["lightgbm", "xgboost"] as const).map(m => {
                    const met = DEMO_MODEL_METRICS[m];
                    const color = m === "lightgbm" ? "#2DD4BF" : "#6366F1";
                    return (
                      <GlassPanel key={m} padding="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          <span className="font-display font-semibold text-cc-text">
                            {m === "lightgbm" ? "LightGBM" : "XGBoost"}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {[
                            { label: "PR-AUC",    val: met.prAuc,    note: "primary metric" },
                            { label: "ROC-AUC",   val: met.rocAuc },
                            { label: "Trees",     val: met.trees },
                            { label: "Threshold", val: met.threshold, note: "tuned" },
                          ].map(s => (
                            <div key={s.label} className="flex items-center justify-between py-1 border-b border-cc-border/40 last:border-0">
                              <span className="text-cc-muted text-xs font-mono">
                                {s.label}
                                {s.note && <span className="text-cc-subtle ml-1">({s.note})</span>}
                              </span>
                              <span
                                className="font-mono font-semibold text-sm"
                                style={{ color: s.val > 0.8 ? "#2DD4BF" : s.val > 0.6 ? "#F5A524" : "#E6EDF3" }}
                              >
                                {s.val.toFixed(3)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </GlassPanel>
                    );
                  })}

                  <GlassPanel className="md:col-span-2" padding="p-4">
                    <div className="text-cc-muted text-[10px] font-semibold tracking-widest uppercase mb-3">Training Methodology</div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      {[
                        { k: "CV Strategy",   v: "TimeSeriesExpandingCV" },
                        { k: "Folds",         v: "5 (pure time-based)" },
                        { k: "Gap",           v: "144 samples (24 h)" },
                        { k: "HPO",           v: "Optuna TPE, 50 trials" },
                        { k: "Imbalance",     v: "scale_pos_weight ≈ 9.8" },
                        { k: "Objective",     v: "PR-AUC (≈9% positive)" },
                      ].map(s => (
                        <div key={s.k}>
                          <div className="text-cc-subtle font-mono text-[10px] uppercase mb-0.5">{s.k}</div>
                          <div className="font-mono text-cc-text text-[11px]">{s.v}</div>
                        </div>
                      ))}
                    </div>
                  </GlassPanel>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* ── Right: risk panel ─────────────────────────────────────────── */}
        <aside className="w-56 flex-shrink-0 flex flex-col gap-3">
          {/* Gauge */}
          <GlassPanel padding="p-4" className="flex flex-col items-center">
            <div className="text-cc-muted text-[10px] font-semibold tracking-widest uppercase mb-3">
              24h Failure Risk
              <Tooltip content="The model's estimated probability of a failure event within 24 hours, at the current simulated time.">
                <span className="ml-1 cursor-help text-cc-subtle"><Info size={10} /></span>
              </Tooltip>
            </div>
            <Gauge
              value={currentFp}
              size={136}
              label={`${selectedMachine.id} · t=${playhead}`}
            />
            <div className="mt-3">
              <RiskBadge level={riskLevel} pulse={riskLevel === "CRITICAL" || riskLevel === "HIGH"} />
            </div>
          </GlassPanel>

          {/* Playback controls */}
          <GlassPanel padding="p-3">
            <div className="text-cc-muted text-[10px] font-semibold tracking-widest uppercase mb-3">Playback</div>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => { setPlayhead(0); setIsPlaying(false); }}
                aria-label="Reset to start"
                className="w-8 h-8 rounded-lg glass flex items-center justify-center text-cc-muted hover:text-cc-text transition-colors cursor-pointer"
              >
                <SkipBack size={14} />
              </button>
              <button
                onClick={() => setIsPlaying(p => !p)}
                aria-label={isPlaying ? "Pause" : "Play"}
                className={clsx(
                  "flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer",
                  isPlaying
                    ? "bg-cc-danger/15 border border-cc-danger/30 text-cc-danger hover:bg-cc-danger/20"
                    : "bg-cc-healthy/15 border border-cc-healthy/30 text-cc-healthy hover:bg-cc-healthy/20"
                )}
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} />}
                {isPlaying ? "Pause" : "Play"}
              </button>
            </div>

            <div className="text-cc-subtle text-[10px] font-mono mb-1.5">SPEED</div>
            <div className="grid grid-cols-4 gap-1 mb-3">
              {SPEEDS.map(s => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={clsx(
                    "h-6 rounded text-[10px] font-mono transition-all border cursor-pointer",
                    speed === s
                      ? "border-cc-healthy/50 text-cc-healthy bg-cc-healthy/10"
                      : "border-cc-border text-cc-muted hover:border-cc-border-strong"
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>

            <div className="text-cc-subtle text-[10px] font-mono mb-1">POSITION</div>
            <input
              type="range"
              min={0}
              max={seriesLen - WINDOW - 1}
              value={playhead}
              onChange={e => { setIsPlaying(false); setPlayhead(+e.target.value); }}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              aria-label="Time position scrubber"
            />
            <div className="flex justify-between text-[9px] font-mono text-cc-subtle mt-0.5">
              <span>0</span>
              <span className="text-cc-muted">{playhead}</span>
              <span>{seriesLen - WINDOW - 1}</span>
            </div>
          </GlassPanel>

          {/* Risk factors */}
          <GlassPanel padding="p-3" className="flex-1 overflow-y-auto">
            <div className="text-cc-muted text-[10px] font-semibold tracking-widest uppercase mb-2">
              Risk Factors
            </div>
            {selectedMachine.topRiskFactors.map(f => (
              <div key={f.feature} className="flex items-center gap-2 py-1.5 border-b border-cc-border/40 last:border-0">
                {f.direction === "increasing" ? (
                  <TrendingUp size={12} className="text-cc-danger flex-shrink-0" />
                ) : f.direction === "decreasing" ? (
                  <TrendingDown size={12} className="text-cc-caution flex-shrink-0" />
                ) : (
                  <Minus size={12} className="text-cc-subtle flex-shrink-0" />
                )}
                <span className="flex-1 text-[10px] font-mono text-cc-text truncate">{f.feature}</span>
                <span className="text-[10px] font-mono text-cc-muted w-8 text-right">
                  {(f.importance * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </GlassPanel>

          {/* Current readings */}
          <CurrentReadings machine={selectedMachine} playhead={playhead} />

          {/* CTA to real dashboard */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-signal-gradient text-cc-ink text-sm font-display font-semibold hover:opacity-90 transition-opacity"
          >
            <Upload size={14} />
            Try with your data
          </Link>
        </aside>
      </div>

      <Footer />
    </div>
  );
}
