"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Activity, ShieldCheck, Zap, Clock, Database, BarChart3, Upload, ChevronRight } from "lucide-react";
import { clsx } from "clsx";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { Gauge } from "../components/ui/Gauge";
import { GlassPanel } from "../components/ui/GlassPanel";
import { RiskBadge } from "../components/ui/Badge";
import { Reveal, Stagger, StaggerItem, AnimatedNumber, MagneticButton } from "../components/motion";
import { DEMO_FLEET_STATS, DEMO_MACHINES } from "../lib/demo-data";

/* ── Animated sensor waveform in hero ─────────────────────────────────────── */
function HeroWaveform() {
  const [phase, setPhase] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    let t = 0;
    function step() {
      t += 0.012;
      setPhase(t);
      frameRef.current = requestAnimationFrame(step);
    }
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const N = 120;
  const points = Array.from({ length: N }, (_, i) => {
    const x = (i / (N - 1)) * 320;
    const progress = i / N;
    const base = 30;
    const signal = Math.sin(i * 0.18 + phase) * 8
                 + Math.sin(i * 0.07 + phase * 0.5) * 4;
    const degradation = progress > 0.55
      ? Math.exp((progress - 0.55) * 5) * 14 * Math.sin(i * 0.5 + phase * 2.5)
      : 0;
    const y = base + signal + degradation;
    return `${x.toFixed(1)},${Math.max(4, Math.min(56, y)).toFixed(1)}`;
  }).join(" ");

  const dangerStart = (0.55 / 1) * 320;

  return (
    <svg viewBox="0 0 320 60" className="w-full" preserveAspectRatio="none" style={{ height: 60 }}>
      <defs>
        <linearGradient id="wave-grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"  stopColor="#2DD4BF" stopOpacity="0" />
          <stop offset="40%" stopColor="#2DD4BF" stopOpacity="1" />
          <stop offset="65%" stopColor="#F5A524" stopOpacity="1" />
          <stop offset="85%" stopColor="#FB3B5C" stopOpacity="1" />
          <stop offset="100%" stopColor="#FB3B5C" stopOpacity="0.6" />
        </linearGradient>
        <clipPath id="wave-clip">
          <rect x="0" y="0" width="320" height="60" />
        </clipPath>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke="url(#wave-grad)"
        strokeWidth="1.5"
        clipPath="url(#wave-clip)"
        style={{ filter: "drop-shadow(0 0 4px rgba(45,212,191,0.4))" }}
      />
      <line
        x1={dangerStart} x2={dangerStart} y1="0" y2="60"
        stroke="rgba(245,165,36,0.4)" strokeWidth="1" strokeDasharray="3 3"
      />
    </svg>
  );
}

/* ── Pulsing risk gauge that cycles healthy → critical ──────────────────── */
function AnimatedRiskGauge() {
  const [prob, setProb] = useState(0.05);
  const dirRef = useRef(1);

  useEffect(() => {
    const id = setInterval(() => {
      setProb(p => {
        const next = p + dirRef.current * 0.003;
        if (next >= 0.92) dirRef.current = -1;
        if (next <= 0.04) dirRef.current = 1;
        return Math.max(0, Math.min(1, next));
      });
    }, 40);
    return () => clearInterval(id);
  }, []);

  return <Gauge value={prob} size={140} />;
}

/* ── Floating live machine mini-card ─────────────────────────────────────── */
function MiniMachineCard({ machine, style }: {
  machine: (typeof DEMO_MACHINES)[0];
  style?: React.CSSProperties;
}) {
  const color = machine.failureProbability > 0.7 ? "#FB3B5C"
    : machine.failureProbability > 0.4 ? "#F5A524"
    : "#2DD4BF";

  return (
    <div
      className="glass rounded-xl px-3 py-2.5 w-40 absolute"
      style={{ ...style, animation: `float ${4 + (style?.animationDelay ? 1 : 0)}s ease-in-out infinite`, animationDelay: style?.animationDelay as string }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[10px] font-bold text-cc-healthy">{machine.id}</span>
        <RiskBadge level={machine.currentStatus} />
      </div>
      <div className="flex justify-between text-[9px]">
        <span className="text-cc-subtle">Vib</span>
        <span className="font-mono" style={{ color }}>{machine.lastReading.vibration} mm/s</span>
      </div>
      <div className="flex justify-between text-[9px]">
        <span className="text-cc-subtle">Risk</span>
        <span className="font-mono font-bold" style={{ color }}>
          {(machine.failureProbability * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

/* ── Use-case card ───────────────────────────────────────────────────────── */
function UseCaseCard({ icon: Icon, title, machines, color }: {
  icon: React.ElementType;
  title: string;
  machines: string;
  color: string;
}) {
  return (
    <StaggerItem>
      <GlassPanel hover className="h-full" padding="p-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <div className="font-display font-semibold text-cc-text text-sm mb-1">{title}</div>
        <div className="text-cc-muted text-xs font-mono">{machines}</div>
      </GlassPanel>
    </StaggerItem>
  );
}

/* ── Step card ───────────────────────────────────────────────────────────── */
function ExplainerStep({ num, title, body, icon: Icon }: {
  num: string; title: string; body: string; icon: React.ElementType;
}) {
  return (
    <StaggerItem>
      <div className="flex gap-4 items-start">
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-8 h-8 rounded-full border border-cc-healthy/40 text-cc-healthy text-xs font-mono font-bold flex items-center justify-center shadow-healthy-glow">
            {num}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Icon size={14} className="text-cc-healthy" />
            <span className="font-display font-semibold text-cc-text text-sm">{title}</span>
          </div>
          <p className="text-cc-muted text-sm leading-relaxed">{body}</p>
        </div>
      </div>
    </StaggerItem>
  );
}

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <div className="min-h-dvh bg-cc-bg text-cc-text overflow-x-hidden">
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative min-h-dvh flex items-center pt-[60px]">
        {/* Background */}
        <div className="absolute inset-0 bg-hero-radial opacity-60 pointer-events-none" />
        <div className="absolute inset-0 bg-grid-cc opacity-40 pointer-events-none" />
        <div className="aurora-mesh absolute inset-0 pointer-events-none" />

        <div className="relative max-w-screen-xl mx-auto w-full px-4 py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          {/* Left — copy */}
          <div>
            <motion.div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-cc-healthy/30 text-cc-healthy text-[11px] font-mono tracking-widest uppercase mb-6"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{ background: "rgba(45,212,191,0.06)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cc-healthy animate-ping" />
              Predictive Maintenance · In-Browser AI
            </motion.div>

            <motion.h1
              className="font-display font-bold leading-[1.08] mb-6"
              style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.8rem)" }}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              Know which machine<br />will fail —{" "}
              <span className="text-signal">
                a full day before it does.
              </span>
            </motion.h1>

            <motion.p
              className="text-cc-muted text-lg leading-relaxed mb-8 max-w-xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
            >
              YieldGuard reads sensor data from your machines, spots degradation patterns invisible to the naked eye, and gives your maintenance team a full 24-hour warning — before a breakdown brings your line to a halt.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-3 mb-10"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.24 }}
            >
              <MagneticButton>
                <Link
                  href="/demo"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-signal-gradient text-cc-ink font-display font-semibold hover:opacity-90 transition-opacity"
                >
                  Try live demo <ArrowRight size={15} />
                </Link>
              </MagneticButton>
              <Link
                href="/dashboard"
                className="glass-hover flex items-center gap-2 px-6 py-3 rounded-xl text-cc-text font-display font-semibold transition-all"
              >
                Analyze your data <ChevronRight size={15} className="text-cc-muted" />
              </Link>
            </motion.div>

            {/* Trust row */}
            <motion.div
              className="flex flex-wrap gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.32 }}
            >
              {[
                { val: "24h", label: "advance warning" },
                { val: "196+", label: "sensor features" },
                { val: "0%", label: "data leaves device" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <ShieldCheck size={12} className="text-cc-healthy flex-shrink-0" />
                  <span className="font-display font-bold text-cc-text">{s.val}</span>
                  <span className="text-cc-muted">{s.label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right — live vitals canvas */}
          <motion.div
            className="relative flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative w-full max-w-sm mx-auto">
              {/* Central card */}
              <GlassPanel glow="signal" padding="p-6" className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="text-cc-muted text-[10px] font-mono tracking-widest uppercase mb-0.5">
                      Live Risk Monitor
                    </div>
                    <div className="font-display font-bold text-cc-text">Machine M-001</div>
                  </div>
                  <RiskBadge level="CRITICAL" pulse />
                </div>

                <div className="flex items-center justify-center mb-4">
                  <AnimatedRiskGauge />
                </div>

                <div className="mb-3">
                  <div className="text-cc-muted text-[9px] font-mono tracking-widest uppercase mb-1">
                    VIBRATION · mm/s
                  </div>
                  <HeroWaveform />
                  <div className="flex justify-between text-[8px] font-mono text-cc-subtle mt-0.5">
                    <span>–72h</span>
                    <span className="text-cc-caution">degradation onset</span>
                    <span className="text-cc-danger">now</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Temp",  val: "87°C", color: "#FB3B5C" },
                    { label: "Vib",   val: "8.4", color: "#F5A524" },
                    { label: "RPM",   val: "1390", color: "#A78BFA" },
                  ].map(s => (
                    <div key={s.label} className="bg-cc-raised/60 rounded-lg py-1.5">
                      <div className="font-mono text-xs font-bold sensor-val" style={{ color: s.color }}>
                        {s.val}
                      </div>
                      <div className="text-[8px] text-cc-subtle font-mono tracking-wide uppercase">{s.label}</div>
                    </div>
                  ))}
                </div>
              </GlassPanel>

              {/* Floating mini cards */}
              <MiniMachineCard
                machine={DEMO_MACHINES[1]}
                style={{ top: -16, right: -20, animationDelay: "0s" }}
              />
              <MiniMachineCard
                machine={DEMO_MACHINES[3]}
                style={{ bottom: -12, left: -20, animationDelay: "1.8s" }}
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Metrics strip ─────────────────────────────────────────────────── */}
      <div className="border-y border-cc-border bg-cc-surface/60 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-6">
          <Stagger className="flex flex-wrap justify-center gap-8 md:gap-16">
            {[
              { to: 196,    suffix: "+",  label: "Features engineered", decimals: 0 },
              { to: 500443, suffix: "",   label: "Training data points", decimals: 0 },
              { to: 24,     suffix: "h",  label: "Prediction horizon",  decimals: 0 },
              { to: 0.85,   suffix: "",   label: "PR-AUC (validation)", decimals: 2 },
            ].map(s => (
              <StaggerItem key={s.label}>
                <div className="text-center">
                  <div className="font-display font-bold text-2xl text-cc-text">
                    <AnimatedNumber to={s.to} suffix={s.suffix} decimals={s.decimals} />
                  </div>
                  <div className="text-cc-subtle text-[10px] font-mono tracking-widest uppercase mt-0.5">
                    {s.label}
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>

      {/* ── 3-step plain-language explainer ───────────────────────────────── */}
      <section className="py-20 max-w-screen-xl mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div>
            <Reveal>
              <div className="inline-block text-[10px] font-mono tracking-widest uppercase text-cc-healthy mb-4 border border-cc-healthy/30 px-3 py-1 rounded-full" style={{ background: "rgba(45,212,191,0.06)" }}>
                How it works
              </div>
              <h2 className="font-display font-bold text-cc-text mb-4" style={{ fontSize: "clamp(1.8rem, 3vw, 2.6rem)" }}>
                Like a doctor's check-up —<br />
                <span className="text-signal">for your machines.</span>
              </h2>
              <p className="text-cc-muted text-base leading-relaxed">
                Just as a doctor reads vital signs to catch illness early, YieldGuard reads your machine's sensor signals to detect wear, stress, and abnormal behavior — before anything breaks.
              </p>
            </Reveal>
          </div>

          <div>
            <Stagger staggerDelay={0.12} className="space-y-6">
              <ExplainerStep
                num="01"
                icon={Database}
                title="Connect your sensors (or try with sample data)"
                body="Upload a CSV from your historian or PLC — or use the quick-try panel to enter current readings manually. No setup, no integration needed."
              />
              <ExplainerStep
                num="02"
                icon={Activity}
                title="AI analyzes 196 patterns instantly"
                body="The model computes statistical fingerprints across vibration, temperature, pressure, current, RPM, and acoustics — looking at trends, spikes, and frequency signatures."
              />
              <ExplainerStep
                num="03"
                icon={Zap}
                title="Get a plain-language 24h warning"
                body="A clear risk score with an action: schedule maintenance, dispatch crew, or keep monitoring. No jargon, no false alarms — just what you need to know."
              />
            </Stagger>
          </div>
        </div>
      </section>

      {/* ── Fleet status demo strip ────────────────────────────────────────── */}
      <section className="py-16 bg-cc-surface/30 border-y border-cc-border">
        <div className="max-w-screen-xl mx-auto px-4">
          <Reveal className="text-center mb-8">
            <div className="text-[10px] font-mono tracking-widest uppercase text-cc-muted mb-2">Demo fleet · 5 sample machines</div>
            <h3 className="font-display font-bold text-cc-text text-xl">Real-time fleet overview</h3>
          </Reveal>

          <Stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {DEMO_MACHINES.map(m => {
              const color = m.failureProbability > 0.7 ? "#FB3B5C"
                : m.failureProbability > 0.4 ? "#F5A524" : "#2DD4BF";
              return (
                <StaggerItem key={m.id}>
                  <GlassPanel padding="p-3" className="text-center">
                    <div className="font-mono font-bold text-xs mb-1" style={{ color }}>
                      {m.id}
                    </div>
                    <div className="text-cc-subtle text-[9px] mb-2 truncate">{m.type}</div>
                    <Gauge value={m.failureProbability} size={64} showValue={false} />
                    <div className="mt-2">
                      <RiskBadge level={m.currentStatus} />
                    </div>
                  </GlassPanel>
                </StaggerItem>
              );
            })}
          </Stagger>

          <Reveal className="text-center mt-6">
            <Link
              href="/demo"
              className="inline-flex items-center gap-1.5 text-cc-healthy text-sm font-mono hover:gap-2.5 transition-all"
            >
              Explore the interactive demo <ArrowRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Use cases ─────────────────────────────────────────────────────── */}
      <section className="py-20 max-w-screen-xl mx-auto px-4">
        <Reveal className="text-center mb-10">
          <div className="text-[10px] font-mono tracking-widest uppercase text-cc-muted mb-3 border border-cc-border inline-block px-3 py-1 rounded-full">
            Works with
          </div>
          <h2 className="font-display font-bold text-cc-text" style={{ fontSize: "clamp(1.6rem, 2.5vw, 2.2rem)" }}>
            Any machine with sensors
          </h2>
        </Reveal>

        <Stagger className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <UseCaseCard icon={Activity}    color="#2DD4BF" title="CNC Spindles"        machines="Milling · Turning · Drilling" />
          <UseCaseCard icon={BarChart3}   color="#6366F1" title="Hydraulic Presses"   machines="Stamping · Forging · Forming" />
          <UseCaseCard icon={Zap}         color="#F5A524" title="Coolant Pumps"       machines="Centrifugal · Gear · Diaphragm" />
          <UseCaseCard icon={ShieldCheck} color="#34D399" title="Conveyor Drives"     machines="Belt · Roller · Chain systems" />
        </Stagger>
      </section>

      {/* ── Key capabilities strip ────────────────────────────────────────── */}
      <section className="py-16 bg-cc-surface/30 border-y border-cc-border">
        <div className="max-w-screen-xl mx-auto px-4">
          <Stagger className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: ShieldCheck,
                color: "#2DD4BF",
                title: "Runs entirely in your browser",
                body: "The AI model is downloaded once and runs locally. No sensor readings ever leave your device.",
              },
              {
                icon: Zap,
                color: "#6366F1",
                title: "Results in under a second",
                body: "196-feature computation and tree-ensemble scoring happen client-side — no API call, no waiting.",
              },
              {
                icon: BarChart3,
                color: "#F5A524",
                title: "Explains every prediction",
                body: "Plain-English risk factors tell you exactly which sensor triggered the alert and in which direction.",
              },
            ].map(c => (
              <StaggerItem key={c.title}>
                <GlassPanel hover padding="p-6" className="h-full">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${c.color}12`, border: `1px solid ${c.color}25` }}
                  >
                    <c.icon size={20} style={{ color: c.color }} />
                  </div>
                  <div className="font-display font-semibold text-cc-text mb-2">{c.title}</div>
                  <p className="text-cc-muted text-sm leading-relaxed">{c.body}</p>
                </GlassPanel>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ── Tech specs callout (for technical readers) ────────────────────── */}
      <section className="py-16 max-w-screen-xl mx-auto px-4">
        <Reveal>
          <GlassPanel padding="p-6 md:p-8">
            <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
              <div className="flex-1">
                <div className="text-[10px] font-mono tracking-widest uppercase text-cc-muted mb-2">Under the hood</div>
                <h3 className="font-display font-bold text-cc-text text-lg mb-3">
                  Production-grade ML, not a toy model
                </h3>
                <p className="text-cc-muted text-sm leading-relaxed mb-4">
                  LightGBM + XGBoost ensemble, trained with time-series expanding cross-validation (no data leakage), Optuna Bayesian HPO, isotonic calibration for honest probabilities, and PSI drift monitoring in production.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["LightGBM", "XGBoost", "Optuna", "SHAP", "scikit-learn", "FastAPI"].map(t => (
                    <span key={t} className="text-[10px] font-mono text-cc-muted border border-cc-border px-2 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex-shrink-0 grid grid-cols-2 gap-3">
                {[
                  { label: "PR-AUC",   val: DEMO_FLEET_STATS.avgPrAuc.toFixed(3), color: "#2DD4BF" },
                  { label: "ROC-AUC",  val: DEMO_FLEET_STATS.avgRocAuc.toFixed(3), color: "#6366F1" },
                  { label: "Features", val: "196+",                                color: "#F5A524"  },
                  { label: "CV Folds", val: "5",                                   color: "#34D399"  },
                ].map(s => (
                  <div key={s.label} className="bg-cc-raised rounded-xl p-3 text-center min-w-[80px]">
                    <div className="font-mono font-bold text-base" style={{ color: s.color }}>{s.val}</div>
                    <div className="text-[9px] text-cc-subtle font-mono tracking-wide uppercase mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-cc-border flex items-center gap-3">
              <Link
                href="/about"
                className="text-cc-muted hover:text-cc-text text-xs font-mono transition-colors flex items-center gap-1"
              >
                Full methodology <ChevronRight size={11} />
              </Link>
              <span className="text-cc-border">·</span>
              <Link
                href="/guide"
                className="text-cc-muted hover:text-cc-text text-xs font-mono transition-colors flex items-center gap-1"
              >
                How to use it <ChevronRight size={11} />
              </Link>
            </div>
          </GlassPanel>
        </Reveal>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-signal-gradient opacity-5 pointer-events-none" />
        <div className="absolute inset-0 bg-grid-cc opacity-20 pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <Reveal>
            <div className="text-[10px] font-mono tracking-widest uppercase text-cc-healthy mb-4">
              Ready to predict failures before they happen?
            </div>
            <h2 className="font-display font-bold text-cc-text mb-4" style={{ fontSize: "clamp(1.8rem, 3vw, 2.8rem)" }}>
              Try it now — no signup,<br />
              <span className="text-signal">no data leaves your device.</span>
            </h2>
            <p className="text-cc-muted text-base leading-relaxed mb-8">
              Explore the demo with 5 pre-loaded machines, or upload your own sensor CSV and get an instant 24h failure prediction.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <MagneticButton>
                <Link
                  href="/demo"
                  className="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-signal-gradient text-cc-ink font-display font-bold text-base hover:opacity-90 transition-opacity"
                  style={{ boxShadow: "0 0 40px rgba(45,212,191,0.25)" }}
                >
                  Launch Demo <ArrowRight size={16} />
                </Link>
              </MagneticButton>
              <Link
                href="/dashboard"
                className="glass-hover flex items-center gap-2 px-8 py-3.5 rounded-xl text-cc-text font-display font-semibold text-base transition-all"
              >
                <Upload size={15} className="text-cc-muted" />
                Upload my data
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
