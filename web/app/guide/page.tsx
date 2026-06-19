"use client";

import Link from "next/link";
import { BookOpen, FileSpreadsheet, TrendingUp, AlertTriangle, CheckCircle2, HelpCircle, ArrowRight, ChevronRight } from "lucide-react";
import { Navbar } from "../../components/Navbar";
import { Footer } from "../../components/Footer";
import { GlassPanel } from "../../components/ui/GlassPanel";
import { RiskBadge } from "../../components/ui/Badge";
import { Gauge } from "../../components/ui/Gauge";
import { Reveal, Stagger, StaggerItem } from "../../components/motion";

const TOC = [
  { id: "what-is",   label: "What is YieldGuard?" },
  { id: "readings",  label: "Reading results" },
  { id: "prepare",   label: "Preparing your data" },
  { id: "columns",   label: "CSV column reference" },
  { id: "faq",       label: "FAQ" },
];

function Section({ id, title, icon: Icon, children }: {
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="pt-8 scroll-mt-28">
      <Reveal>
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cc-healthy/10 border border-cc-healthy/25">
            <Icon size={15} className="text-cc-healthy" />
          </div>
          <h2 className="font-display font-bold text-cc-text text-xl">{title}</h2>
        </div>
        {children}
      </Reveal>
    </section>
  );
}

const CSV_COLUMNS = [
  {
    col: "timestamp",
    example: "2024-01-01T08:00",
    required: false,
    desc: "ISO 8601 datetime (optional). If omitted, YieldGuard treats rows as consecutive 10-minute readings.",
  },
  {
    col: "vibration_mm_s",
    example: "2.45",
    required: true,
    desc: "Overall vibration amplitude in mm/s (RMS). Typically from an accelerometer on bearing housings. Normal: 1–5 mm/s.",
  },
  {
    col: "temperature_c",
    example: "64.8",
    required: true,
    desc: "Operating temperature in °C measured at bearing or motor casing. Normal: 50–80 °C for most drives.",
  },
  {
    col: "pressure_bar",
    example: "8.1",
    required: true,
    desc: "Hydraulic or process pressure in bar. Normal varies by application — stable values matter more than absolute numbers.",
  },
  {
    col: "current_a",
    example: "12.1",
    required: true,
    desc: "Motor phase current in amps (RMS, any one phase). Rising current at constant load signals mechanical friction or winding degradation.",
  },
  {
    col: "rpm",
    example: "1476",
    required: true,
    desc: "Shaft rotation speed in revolutions per minute. Unexpected slowdown relative to setpoint is an early wear indicator.",
  },
  {
    col: "acoustic_db",
    example: "71.8",
    required: true,
    desc: "Acoustic emission or airborne sound level in decibels (dB SPL). Elevated levels may indicate bearing defects or cavitation.",
  },
];

const FAQ = [
  {
    q: "What if I don't have all 6 sensor channels?",
    a: "The model needs all 6 columns. If your historian doesn't log one (e.g. acoustic), fill it with typical values for your machine class — the model will still capture trends in the channels you do have, though accuracy for acoustic-related failures may reduce.",
  },
  {
    q: "How many rows do I need?",
    a: "At minimum 144 rows (24 hours at 10-minute intervals). More is better — 288 rows (48h) gives the rolling-window features their full context. The upload panel tells you if you have enough.",
  },
  {
    q: "My readings are every 5 minutes, not 10. Will it still work?",
    a: "Yes. Upload as-is. The model's rolling windows are sample-count based, so a 5-minute interval means your 144-reading window covers 12 hours instead of 24. Results are still valid — just scale your interpretation of the horizon accordingly.",
  },
  {
    q: "The risk score is 73% — what does that actually mean?",
    a: "It means the model estimates a 73% probability of a failure event occurring within the next 24 hours, given the pattern in your uploaded data. It is not a certainty — but it means the sensor pattern closely resembles machines that failed within 24 hours in training.",
  },
  {
    q: "Does my data leave my device?",
    a: "No. The model runs entirely in your browser (WebAssembly-like tree scoring in TypeScript). Your CSV never touches a server. You can verify this in your browser's Network tab — no outbound requests are made when you hit 'Run Analysis'.",
  },
  {
    q: "Can I use it for my specific machine type?",
    a: "The model was trained on synthetic data spanning hydraulic presses, CNC spindles, pumps, and conveyor drives. For best accuracy on your specific machine, the trained Python pipeline can be fine-tuned on your historical failure data — see the About page.",
  },
];

export default function GuidePage() {
  return (
    <div className="min-h-dvh bg-cc-bg text-cc-text flex flex-col">
      <Navbar />

      <div className="mt-[60px] border-b border-cc-border bg-cc-surface/60 backdrop-blur-sm">
        <div className="max-w-screen-xl mx-auto px-4 py-8">
          <Reveal>
            <div className="inline-block text-[10px] font-mono tracking-widest uppercase text-cc-healthy border border-cc-healthy/30 px-3 py-1 rounded-full mb-3" style={{ background: "rgba(45,212,191,0.06)" }}>
              User guide
            </div>
            <h1 className="font-display font-bold text-3xl text-cc-text mb-2">
              How to use YieldGuard
            </h1>
            <p className="text-cc-muted text-base max-w-xl">
              Everything you need to go from raw sensor readings to a 24-hour failure prediction — no ML knowledge required.
            </p>
          </Reveal>
        </div>
      </div>

      <div className="flex-1 max-w-screen-xl mx-auto w-full px-4 py-8">
        <div className="flex gap-8 items-start">

          {/* ── Sticky TOC sidebar ─────────────────────────────────────────── */}
          <aside className="hidden lg:block w-48 flex-shrink-0 sticky top-24">
            <div className="text-cc-subtle text-[10px] font-mono tracking-widest uppercase mb-3">On this page</div>
            <nav className="space-y-0.5">
              {TOC.map(item => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="flex items-center gap-1.5 text-cc-muted hover:text-cc-text text-xs py-1.5 transition-colors font-mono"
                >
                  <ChevronRight size={10} className="text-cc-subtle" />
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-6 pt-4 border-t border-cc-border">
              <Link href="/demo" className="flex items-center gap-1 text-cc-healthy text-xs font-mono hover:gap-2 transition-all">
                Try demo <ArrowRight size={11} />
              </Link>
              <Link href="/dashboard" className="flex items-center gap-1 text-cc-muted text-xs font-mono hover:text-cc-text hover:gap-2 transition-all mt-1">
                Upload data <ArrowRight size={11} />
              </Link>
            </div>
          </aside>

          {/* ── Main content ───────────────────────────────────────────────── */}
          <div className="flex-1 max-w-2xl space-y-1 pb-16">

            <Section id="what-is" title="What is YieldGuard?" icon={BookOpen}>
              <div className="text-cc-muted text-sm leading-relaxed space-y-3">
                <p>
                  YieldGuard is a predictive maintenance system — think of it as a <strong className="text-cc-text">doctor's check-up for your machines</strong>. Instead of waiting for a machine to break down and halt production, YieldGuard watches the machine's vital signs (vibration, temperature, current, pressure, RPM, and acoustic level) and learns to recognize the early patterns that appear before a failure.
                </p>
                <p>
                  A trained AI model analyzes these readings and returns a single number: the probability that this machine will fail in the next 24 hours. If that probability is high, your maintenance team can schedule a repair during planned downtime — not at 2am during an emergency.
                </p>
              </div>

              <GlassPanel padding="p-4" className="mt-4">
                <div className="text-cc-muted text-[10px] font-mono tracking-widest uppercase mb-3">Two ways to use it</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-cc-raised rounded-xl p-3">
                    <div className="font-display font-semibold text-cc-text text-sm mb-1">Interactive demo</div>
                    <p className="text-cc-muted text-xs leading-relaxed mb-2">
                      Explore 5 pre-loaded machines with real degradation scenarios. No data needed. Play the timeline and watch the risk gauge respond.
                    </p>
                    <Link href="/demo" className="text-cc-healthy text-xs font-mono flex items-center gap-1 hover:gap-1.5 transition-all">
                      Open demo <ArrowRight size={10} />
                    </Link>
                  </div>
                  <div className="bg-cc-raised rounded-xl p-3">
                    <div className="font-display font-semibold text-cc-text text-sm mb-1">Analyze your own data</div>
                    <p className="text-cc-muted text-xs leading-relaxed mb-2">
                      Upload a CSV from your historian or SCADA, or enter current readings with the quick-try sliders. Get an instant prediction.
                    </p>
                    <Link href="/dashboard" className="text-cc-healthy text-xs font-mono flex items-center gap-1 hover:gap-1.5 transition-all">
                      Go to dashboard <ArrowRight size={10} />
                    </Link>
                  </div>
                </div>
              </GlassPanel>
            </Section>

            <div className="h-8" />

            <Section id="readings" title="Reading the results" icon={TrendingUp}>
              <p className="text-cc-muted text-sm leading-relaxed mb-5">
                After running an analysis, you'll see a result panel with three key parts:
              </p>

              {/* Risk gauge explainer */}
              <GlassPanel padding="p-5" className="mb-4">
                <div className="flex gap-5 items-center">
                  <Gauge value={0.73} size={100} />
                  <div>
                    <div className="font-display font-semibold text-cc-text mb-1">The risk gauge</div>
                    <p className="text-cc-muted text-xs leading-relaxed">
                      The gauge shows the model's predicted probability of failure in the next 24 hours. The color tells you the severity: <span className="text-cc-healthy font-semibold">teal = healthy</span>, <span className="text-cc-caution font-semibold">amber = caution</span>, <span className="text-cc-danger font-semibold">red = danger</span>.
                    </p>
                  </div>
                </div>
              </GlassPanel>

              {/* Risk levels */}
              <Stagger className="space-y-2 mb-5" staggerDelay={0.06}>
                {[
                  { level: "OPERATIONAL", pct: "< 20%",  text: "Readings within normal range. Continue routine monitoring.", action: "Continue normal monitoring." },
                  { level: "MEDIUM",      pct: "20–50%", text: "Early warning signals detected. Not urgent but schedule an inspection.", action: "Inspect within the week." },
                  { level: "HIGH",        pct: "50–75%", text: "Multiple sensors show abnormal patterns. Arrange maintenance soon.", action: "Schedule maintenance within 24 hours." },
                  { level: "CRITICAL",    pct: "> 75%",  text: "Imminent failure pattern. Stop machine if safe and dispatch a crew.", action: "Immediate maintenance required." },
                ].map(r => (
                  <StaggerItem key={r.level}>
                    <div className="glass rounded-xl p-3 flex items-start gap-3">
                      <RiskBadge level={r.level} />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-mono text-cc-muted text-xs">{r.pct}</span>
                          <span className="text-cc-text text-xs font-semibold">{r.action}</span>
                        </div>
                        <p className="text-cc-muted text-[11px]">{r.text}</p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>

              {/* Risk factors */}
              <div className="text-cc-text text-sm font-semibold mb-2">Risk factors</div>
              <p className="text-cc-muted text-sm leading-relaxed">
                Below the gauge you'll see the top contributors to the prediction — which sensors are behaving abnormally and in which direction. Each factor shows the sensor metric name, whether it's trending up or down, and how strongly it influenced the risk score.
              </p>
              <p className="text-cc-muted text-sm leading-relaxed mt-2">
                For example: <em className="text-cc-text">"Vibration variability trending up"</em> means the rolling standard deviation of vibration has increased sharply relative to the machine's normal baseline — a classic bearing wear signature.
              </p>
            </Section>

            <div className="h-8" />

            <Section id="prepare" title="Preparing your sensor data" icon={FileSpreadsheet}>
              <div className="space-y-4 text-cc-muted text-sm leading-relaxed">
                <p>
                  YieldGuard expects a time-ordered CSV with one row per reading. Readings should be at fixed intervals — <strong className="text-cc-text">10 minutes is recommended</strong> (matching PLC historian defaults), but any fixed interval works.
                </p>

                <GlassPanel padding="p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <CheckCircle2 size={14} className="text-cc-healthy flex-shrink-0 mt-0.5" />
                    <div className="font-display font-semibold text-cc-text text-sm">Checklist before uploading</div>
                  </div>
                  <ul className="space-y-2">
                    {[
                      "At least 144 rows (24 hours at 10-minute intervals)",
                      "Rows sorted oldest first (ascending timestamp)",
                      "No gaps larger than 2× your interval — use forward-fill or interpolation for brief missing periods",
                      "Values in the expected units (see column reference below)",
                      "One machine per file — mix no IDs",
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-1 h-1 rounded-full bg-cc-healthy flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </GlassPanel>

                <div>
                  <div className="font-display font-semibold text-cc-text mb-1">Where to get the data</div>
                  <ul className="list-disc list-inside space-y-1 text-xs pl-1">
                    <li><strong className="text-cc-text">PLC historian</strong> (SCADA/DCS) — export to CSV directly from Ignition, FactoryTalk, Wonderware, or similar</li>
                    <li><strong className="text-cc-text">Condition monitoring system</strong> (SKF, Emerson, Fluke) — export trend data for the target machine</li>
                    <li><strong className="text-cc-text">Edge gateway</strong> (AWS IoT Greengrass, Azure IoT Edge) — query time-range and download</li>
                    <li>No historian? Use the <strong className="text-cc-text">Quick Try sliders</strong> on the dashboard to dial in current readings manually</li>
                  </ul>
                </div>
              </div>
            </Section>

            <div className="h-8" />

            <Section id="columns" title="CSV column reference" icon={FileSpreadsheet}>
              <div className="overflow-x-auto rounded-xl border border-cc-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-cc-border bg-cc-surface/40">
                      <th className="text-left px-3 py-2 text-cc-subtle font-mono tracking-widest uppercase text-[10px]">Column</th>
                      <th className="text-left px-3 py-2 text-cc-subtle font-mono tracking-widest uppercase text-[10px]">Required</th>
                      <th className="text-left px-3 py-2 text-cc-subtle font-mono tracking-widest uppercase text-[10px]">Example</th>
                      <th className="text-left px-3 py-2 text-cc-subtle font-mono tracking-widest uppercase text-[10px]">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CSV_COLUMNS.map((c, i) => (
                      <tr key={c.col} className={i % 2 === 0 ? "bg-cc-surface/20" : ""}>
                        <td className="px-3 py-2.5 font-mono text-cc-healthy whitespace-nowrap">{c.col}</td>
                        <td className="px-3 py-2.5 text-center">
                          {c.required
                            ? <span className="text-cc-healthy">✓</span>
                            : <span className="text-cc-subtle">—</span>}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-cc-muted whitespace-nowrap">{c.example}</td>
                        <td className="px-3 py-2.5 text-cc-muted leading-relaxed">{c.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <a
                  href="#"
                  onClick={e => {
                    e.preventDefault();
                    const header = "timestamp,vibration_mm_s,temperature_c,pressure_bar,current_a,rpm,acoustic_db";
                    const rows = [
                      "2024-01-01T00:00,2.45,64.8,8.1,12.1,1476,71.8",
                      "2024-01-01T00:10,2.51,65.0,8.0,12.0,1474,72.1",
                      "2024-01-01T00:20,2.48,65.2,7.9,12.2,1477,71.9",
                    ];
                    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url; a.download = "yieldguard-template.csv"; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="text-cc-healthy text-xs font-mono underline underline-offset-2 flex items-center gap-1"
                >
                  Download template CSV <ArrowRight size={11} />
                </a>
              </div>
            </Section>

            <div className="h-8" />

            <Section id="faq" title="FAQ" icon={HelpCircle}>
              <div className="space-y-3">
                {FAQ.map((item, i) => (
                  <Reveal key={i} delay={i * 0.04}>
                    <GlassPanel padding="p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle size={13} className="text-cc-caution flex-shrink-0 mt-0.5" />
                        <div className="font-display font-semibold text-cc-text text-sm">{item.q}</div>
                      </div>
                      <p className="text-cc-muted text-xs leading-relaxed pl-5">{item.a}</p>
                    </GlassPanel>
                  </Reveal>
                ))}
              </div>
            </Section>

            <div className="h-12" />

            {/* Next step CTA */}
            <Reveal>
              <GlassPanel glow="signal" padding="p-5">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <div className="font-display font-bold text-cc-text mb-1">Ready to try it?</div>
                    <p className="text-cc-muted text-xs">
                      The demo runs the real model on sample machine data — no signup, no uploads needed.
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href="/demo" className="px-4 py-2 rounded-xl bg-signal-gradient text-cc-ink text-sm font-display font-semibold hover:opacity-90 transition-opacity">
                      Open demo
                    </Link>
                    <Link href="/dashboard" className="glass-hover px-4 py-2 rounded-xl text-cc-text text-sm font-display font-semibold transition-all">
                      Upload data
                    </Link>
                  </div>
                </div>
              </GlassPanel>
            </Reveal>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
