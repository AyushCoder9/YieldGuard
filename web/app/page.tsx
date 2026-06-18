"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DEMO_FLEET_STATS, DEMO_MACHINES } from "../lib/demo-data";
import { StatusBadge } from "../components/ui/StatusBadge";
import { GaugeChart } from "../components/ui/GaugeChart";

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      let start = 0;
      const step = to / 60;
      const id = setInterval(() => {
        start = Math.min(start + step, to);
        setVal(Math.floor(start));
        if (start >= to) clearInterval(id);
      }, 16);
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

// ── Animated sensor waveform ──────────────────────────────────────────────────
function SensorWave() {
  const points = Array.from({ length: 200 }, (_, i) => {
    const x = i * 6;
    const base = 40;
    const y = base
      + Math.sin(i * 0.15) * 12
      + Math.sin(i * 0.08) * 6
      + (i > 140 ? Math.sin((i - 140) * 0.4) * 18 * Math.exp((i - 140) / 40) : 0);
    return `${x},${Math.max(5, Math.min(75, y))}`;
  }).join(" ");

  return (
    <svg viewBox="0 0 1200 80" className="w-full opacity-30" preserveAspectRatio="none">
      <defs>
        <linearGradient id="wg" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#F0A500" stopOpacity="0" />
          <stop offset="40%" stopColor="#F0A500" stopOpacity="0.8" />
          <stop offset="80%" stopColor="#FF3B5C" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FF3B5C" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <polyline points={points} fill="none" stroke="url(#wg)" strokeWidth="1.5" />
      <line x1="840" x2="840" y1="0" y2="80" stroke="#F0A50060" strokeWidth="1" strokeDasharray="3,3" />
    </svg>
  );
}

// ── Floating machine card ─────────────────────────────────────────────────────
function FloatingMachineCard({ machine, delay }: { machine: (typeof DEMO_MACHINES)[0]; delay: number }) {
  return (
    <div
      className="hmi-panel p-3 rounded-lg text-xs w-44"
      style={{
        animation: `float ${5 + delay}s ease-in-out infinite`,
        animationDelay: `${delay}s`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono font-semibold text-forge-amber text-xs">{machine.id}</span>
        <StatusBadge status={machine.currentStatus} pulse />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-forge-muted font-barlow tracking-wide uppercase text-[10px]">Vib</span>
          <span className="sensor-val">{machine.lastReading.vibration} mm/s</span>
        </div>
        <div className="flex justify-between">
          <span className="text-forge-muted font-barlow tracking-wide uppercase text-[10px]">Temp</span>
          <span className="sensor-val">{machine.lastReading.temperature}°C</span>
        </div>
        <div className="flex justify-between">
          <span className="text-forge-muted font-barlow tracking-wide uppercase text-[10px]">Risk</span>
          <span className={`font-mono text-xs font-semibold ${machine.failureProbability > 0.7 ? "text-forge-red" : machine.failureProbability > 0.4 ? "text-forge-amber" : "text-forge-green"}`}>
            {(machine.failureProbability * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────
function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: number }) {
  return (
    <div className="forge-card p-6 group" style={{ animationDelay: `${delay}s` }}>
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="font-syne font-bold text-forge-text text-base mb-2 group-hover:text-forge-amber transition-colors">{title}</h3>
      <p className="text-forge-muted text-sm leading-relaxed font-dm">{desc}</p>
    </div>
  );
}

// ── Process step ──────────────────────────────────────────────────────────────
function ProcessStep({ num, title, desc, code, last }: { num: string; title: string; desc: string; code: string; last?: boolean }) {
  return (
    <div className="flex gap-6">
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full border border-forge-amber text-forge-amber font-syne font-bold flex items-center justify-center text-sm flex-shrink-0" style={{ boxShadow: "0 0 20px #F0A50030" }}>
          {num}
        </div>
        {!last && <div className="w-px flex-1 bg-gradient-to-b from-forge-amber/40 to-transparent mt-2" />}
      </div>
      <div className="pb-10">
        <h3 className="font-syne font-bold text-forge-text text-lg mb-1">{title}</h3>
        <p className="text-forge-muted text-sm mb-3 leading-relaxed">{desc}</p>
        <code className="block bg-forge-surface border border-forge-border rounded-lg px-4 py-3 text-xs font-mono text-forge-amber leading-relaxed">
          {code}
        </code>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://yieldguard-api.onrender.com";

  useEffect(() => {
    fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(8000) })
      .then(r => setApiStatus(r.ok ? "online" : "offline"))
      .catch(() => setApiStatus("offline"));
  }, [API_URL]);

  return (
    <div className="min-h-screen bg-forge-black relative overflow-hidden">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-forge-border/50 bg-forge-black/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-forge-amber flex items-center justify-center">
              <span className="text-forge-black font-syne font-black text-xs">YG</span>
            </div>
            <span className="font-syne font-bold text-forge-text tracking-tight">YieldGuard</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-dm text-forge-muted">
            <a href="#features" className="hover:text-forge-text transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-forge-text transition-colors">How It Works</a>
            <a href="#tech" className="hover:text-forge-text transition-colors">Tech</a>
            <Link href="/demo" className="hover:text-forge-text transition-colors">Demo</Link>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-mono ${apiStatus === "online" ? "border-forge-green/40 text-forge-green bg-forge-green/10" : apiStatus === "offline" ? "border-forge-red/40 text-forge-red bg-forge-red/10" : "border-forge-border text-forge-muted bg-forge-surface"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === "online" ? "bg-forge-green animate-pulse" : "bg-forge-muted"}`} />
              API {apiStatus === "online" ? "ONLINE" : apiStatus === "offline" ? "OFFLINE" : "..."}
            </div>
            <Link href="/demo" className="bg-forge-amber text-forge-black text-sm font-syne font-bold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
              Live Demo
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-forge-grid opacity-40" />
        <div className="absolute inset-0 bg-hero-radial" />

        {/* Scanline */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-forge-amber/30 to-transparent animate-scan" style={{ animation: "scan 10s linear infinite" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left column */}
          <div className="stagger">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-forge-amber/10 border border-forge-amber/30 text-forge-amber text-xs font-barlow font-semibold tracking-widest uppercase mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-forge-amber animate-pulse" />
              Industrial AI Platform
            </div>

            <h1 className="font-syne font-black leading-[0.95] mb-6" style={{ fontSize: "clamp(2.5rem, 5vw, 4.5rem)" }}>
              <span className="text-forge-text">Predict Failures </span>
              <span className="text-amber-gradient block">Before They</span>
              <span className="text-forge-text">Happen.</span>
            </h1>

            <p className="text-forge-muted text-lg leading-relaxed mb-8 max-w-lg font-dm font-light">
              YieldGuard ingests live PLC & IoT sensor streams, engineers
              <strong className="text-forge-text font-medium"> 256 statistical features</strong>, and predicts
              equipment failure <strong className="text-forge-text font-medium">24 hours in advance</strong> —
              giving maintenance teams time to act.
            </p>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: "Data Points", val: 500443, suffix: "" },
                { label: "Features", val: 256, suffix: "+" },
                { label: "Prediction Lead", val: 24, suffix: "h" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="font-syne font-black text-2xl text-forge-amber">
                    <Counter to={s.val} suffix={s.suffix} />
                  </div>
                  <div className="text-forge-muted text-xs font-barlow tracking-widest uppercase mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/demo" className="bg-forge-amber text-forge-black font-syne font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-all hover:scale-105 flex items-center gap-2">
                <span>Explore Demo</span>
                <span>→</span>
              </Link>
              <Link href="/dashboard" className="border border-forge-border text-forge-text font-syne font-semibold px-6 py-3 rounded-xl hover:border-forge-amber/50 transition-all flex items-center gap-2">
                Live Dashboard
              </Link>
            </div>
          </div>

          {/* Right column — floating cards */}
          <div className="relative hidden lg:flex items-center justify-center h-96">
            <div className="absolute inset-0 bg-forge-amber/5 rounded-2xl border border-forge-amber/10" />

            {/* Central gauge */}
            <div className="relative z-10">
              <GaugeChart value={DEMO_MACHINES[0].failureProbability} size={160} label="M-001 Risk" />
            </div>

            {/* Floating cards */}
            <div className="absolute top-4 left-4">
              <FloatingMachineCard machine={DEMO_MACHINES[1]} delay={0} />
            </div>
            <div className="absolute bottom-4 right-4">
              <FloatingMachineCard machine={DEMO_MACHINES[2]} delay={1.5} />
            </div>
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-4">
              <FloatingMachineCard machine={DEMO_MACHINES[3]} delay={0.8} />
            </div>
          </div>
        </div>

        {/* Waveform at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-0">
          <SensorWave />
          <div className="text-right pr-6 pb-2 text-xs font-mono text-forge-red/70">← vibration_mm_s degradation pattern</div>
        </div>
      </section>

      {/* ── Fleet overview strip ──────────────────────────────────────────── */}
      <section className="border-y border-forge-border/50 bg-forge-surface/50 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="text-forge-muted text-sm font-barlow tracking-widest uppercase">Live Fleet Status</span>
              <span className="text-forge-muted text-xs">(demo data)</span>
            </div>
            <div className="flex flex-wrap gap-6">
              {[
                { label: "Operational", val: DEMO_FLEET_STATS.operational, color: "text-forge-green" },
                { label: "Warning",     val: DEMO_FLEET_STATS.warning,     color: "text-forge-amber" },
                { label: "High Risk",   val: DEMO_FLEET_STATS.high,        color: "text-orange-400" },
                { label: "Critical",    val: DEMO_FLEET_STATS.critical,    color: "text-forge-red" },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className={`font-syne font-black text-2xl ${s.color}`}>{s.val}</div>
                  <div className="text-forge-muted text-xs font-barlow tracking-wider uppercase">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 text-forge-muted text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-forge-green animate-pulse" />
              PR-AUC: <span className="text-forge-green font-semibold">0.847</span>
              &nbsp;|&nbsp;ROC-AUC: <span className="text-forge-green font-semibold">0.923</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-forge-black relative">
        <div className="absolute inset-0 bg-forge-grid opacity-20" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-forge-surface border border-forge-border text-forge-muted text-xs font-barlow tracking-widest uppercase mb-4">
              Platform Capabilities
            </div>
            <h2 className="font-syne font-black text-4xl md:text-5xl text-forge-text mb-4">
              Built for the<br /><span className="text-amber-gradient">Plant Floor</span>
            </h2>
            <p className="text-forge-muted text-lg max-w-2xl mx-auto leading-relaxed">
              Every component is engineered around the realities of industrial sensor data — noise, gaps, drift, and rare failure events.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
            <FeatureCard delay={0.1} icon="📡" title="Real-Time Sensor Ingestion"
              desc="Accepts live PLC/IoT streams over REST. Stateful per-machine buffer maintains 48h of history for full feature computation." />
            <FeatureCard delay={0.2} icon="⚙️" title="256 Engineered Features"
              desc="Rolling statistics, EWMA deviation, lag features, FFT spectral energy, and domain-specific cross-channel ratios — all per-machine to prevent data contamination." />
            <FeatureCard delay={0.3} icon="🧠" title="Dual-Model Ensemble"
              desc="XGBoost + LightGBM trained with TimeSeriesExpandingCV and Bayesian HPO. Median best-iteration refit prevents overfitting on the final model." />
            <FeatureCard delay={0.4} icon="⏱️" title="24-Hour Prediction Horizon"
              desc="144-sample lookahead window with 24h gap between train/val splits eliminates label leakage. Threshold tuned for maximum F1 per model." />
            <FeatureCard delay={0.5} icon="🔍" title="SHAP Explainability"
              desc="Every prediction explained via TreeExplainer SHAP values. Separate /explain endpoint keeps the fast prediction path under 50ms." />
            <FeatureCard delay={0.6} icon="📊" title="PSI Drift Monitor"
              desc="Population Stability Index + Kolmogorov-Smirnov test track feature distribution drift between training reference and live inference." />
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-forge-surface/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="inline-block px-3 py-1 rounded-full bg-forge-surface border border-forge-border text-forge-muted text-xs font-barlow tracking-widest uppercase mb-4">
              Pipeline
            </div>
            <h2 className="font-syne font-black text-4xl md:text-5xl text-forge-text">
              From Raw Signal to<br /><span className="text-amber-gradient">Actionable Alert</span>
            </h2>
          </div>

          <div className="max-w-2xl mx-auto">
            <ProcessStep num="01" title="Synthetic PLC Data Synthesis"
              desc="50 machines × 70 days × 10-min intervals = 504k rows. Physically-modelled exponential degradation ramps, seasonal shift patterns, heteroscedastic noise, and intentional quality issues."
              code={`X(t) = μ + seasonal(t) + degradation(t, t_fail) + spike(t) + ε(t)
degradation: exp(α·progress) ramp, α=3.0 for vibration
positive class: ~9.3%  |  failures: 5–8 per machine`} />
            <ProcessStep num="02" title="Feature Engineering (256 features)"
              desc="FeatureEngineer(TransformerMixin) — serialized alongside model to guarantee inference parity. ALL operations inside groupby('machine_id')."
              code={`Rolling stats   (mean/std/range/skew/kurt) × 4 windows  → 120
EWMA + deviation × 2 spans                              →  24
Lag + diff + pct_change × 4 lags                        →  72
Rate of change (raw + smoothed)                         →  12
FFT energy/dominant_hz/spectral_entropy (subsampled)    →  18
Cross-channel (torque proxy, power, pressure/temp)      →   4`} />
            <ProcessStep num="03" title="Training — TimeSeriesCV + Optuna"
              desc="5-fold expanding window CV with 144-sample (24h) gap. No SMOTE — scale_pos_weight ≈ 9.8 handles imbalance. Final refit uses median best_iteration across folds."
              code={`Objective: PR-AUC (correct metric for ~9% positive class)
HPO: Optuna Bayesian (TPE), 10–50 trials
XGBoost:  PR-AUC 0.851  ROC-AUC 0.926  F1 0.783
LightGBM: PR-AUC 0.843  ROC-AUC 0.919  F1 0.779`} />
            <ProcessStep num="04" title="Serve + Monitor" last
              desc="FastAPI with stateful PerMachineBuffer (288 samples). Single reading per /predict call — buffer handles feature window. Drift monitored via PSI + KS test."
              code={`POST /predict  → failure_probability, risk_level, top_risk_factors
POST /explain  → SHAP waterfall (separate, async-ready)
GET  /drift    → PSI scores, KS p-values, overall status`} />
          </div>
        </div>
      </section>

      {/* ── Tech stack ───────────────────────────────────────────────────── */}
      <section id="tech" className="py-24 bg-forge-black">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-syne font-black text-3xl text-forge-text mb-2">Built With</h2>
            <p className="text-forge-muted text-sm">The exact stack referenced in the JD</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { name: "XGBoost",     role: "Boosting" },
              { name: "LightGBM",   role: "Boosting" },
              { name: "Optuna",      role: "HPO" },
              { name: "SHAP",        role: "Explainability" },
              { name: "Pandas",      role: "Data" },
              { name: "FastAPI",     role: "Serving" },
              { name: "Pydantic v2", role: "Validation" },
              { name: "scikit-learn",role: "Pipelines" },
              { name: "SciPy",       role: "Statistics" },
              { name: "NumPy",       role: "Numerics" },
              { name: "Next.js 15",  role: "Frontend" },
              { name: "Render",      role: "Deploy" },
            ].map(t => (
              <div key={t.name} className="forge-card p-4 text-center">
                <div className="font-syne font-bold text-forge-text text-sm mb-0.5">{t.name}</div>
                <div className="text-forge-muted text-xs font-barlow tracking-wider uppercase">{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-forge-amber/5 to-forge-red/5" />
        <div className="absolute inset-0 bg-forge-grid opacity-20" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="font-syne font-black text-4xl md:text-5xl text-forge-text mb-4">
            See It In Action
          </h2>
          <p className="text-forge-muted text-lg mb-8 leading-relaxed">
            The demo page runs a complete, isolated simulation — pick a machine,
            fast-forward through sensor degradation, and watch the failure
            probability climb in real time.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/demo"
              className="bg-forge-amber text-forge-black font-syne font-black px-8 py-4 rounded-xl text-lg hover:opacity-90 transition-all hover:scale-105"
              style={{ boxShadow: "0 0 40px #F0A50040" }}>
              Launch Interactive Demo →
            </Link>
            <a href="https://github.com/AyushCoder9/YieldGuard" target="_blank" rel="noopener noreferrer"
              className="border border-forge-border text-forge-text font-syne font-semibold px-8 py-4 rounded-xl text-lg hover:border-forge-amber/50 transition-all">
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-forge-border py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-forge-amber flex items-center justify-center">
              <span className="text-forge-black font-black text-xs">YG</span>
            </div>
            <span className="font-syne font-bold text-forge-muted text-sm">YieldGuard</span>
          </div>
          <div className="flex items-center gap-6 text-forge-muted text-xs font-barlow tracking-wider">
            <Link href="/demo" className="hover:text-forge-text transition-colors">Demo</Link>
            <Link href="/dashboard" className="hover:text-forge-text transition-colors">Dashboard</Link>
            <a href="https://github.com/AyushCoder9/YieldGuard" target="_blank" rel="noopener noreferrer" className="hover:text-forge-text transition-colors">GitHub</a>
            <a href={`${API_URL}/docs`} target="_blank" rel="noopener noreferrer" className="hover:text-forge-text transition-colors">API Docs</a>
          </div>
          <div className="text-forge-subtle text-xs font-mono">v1.0.0</div>
        </div>
      </footer>
    </div>
  );
}
