"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { GaugeChart } from "../../components/ui/GaugeChart";

// ── API types ─────────────────────────────────────────────────────────────────
interface HealthResponse {
  status: string;
  timestamp: string;
  model_loaded: boolean;
  model_name?: string;
  version?: string;
}

interface ModelInfo {
  model_name: string;
  model_type: string;
  pr_auc?: number;
  roc_auc?: number;
  threshold?: number;
  training_date?: string;
  feature_count?: number;
  status: string;
}

interface MachineState {
  machine_id: string;
  buffer_size: number;
  buffer_status: "warm" | "warming_up";
  last_prediction?: {
    failure_probability: number;
    risk_level: string;
    timestamp: string;
  };
}

interface DriftReport {
  overall_status: "stable" | "warning" | "critical" | "unavailable";
  feature_count?: number;
  features_drifted?: number;
  timestamp: string;
}

// ── API client ────────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://yieldguard-api.onrender.com";
const API_KEY  = process.env.NEXT_PUBLIC_API_KEY  || "dev-key";

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_URL}${path}`, {
      headers: { "x-api-key": API_KEY },
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    return r.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color = "text-forge-text" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="hmi-panel p-4">
      <div className="text-forge-muted text-[10px] font-barlow tracking-widest uppercase mb-1">{label}</div>
      <div className={`font-syne font-black text-2xl ${color}`}>{value}</div>
      {sub && <div className="text-forge-muted text-xs font-dm mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Status light ─────────────────────────────────────────────────────────────
function StatusLight({ ok }: { ok: boolean | null }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${ok === null ? "bg-forge-muted animate-pulse" : ok ? "bg-forge-green animate-pulse" : "bg-forge-red"}`} />
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [health, setHealth]     = useState<HealthResponse | null>(null);
  const [modelInfo, setModel]   = useState<ModelInfo | null>(null);
  const [machines, setMachines] = useState<MachineState[]>([]);
  const [drift, setDrift]       = useState<DriftReport | null>(null);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    const [h, m, mc, d] = await Promise.all([
      apiFetch<HealthResponse>("/health"),
      apiFetch<ModelInfo>("/model/info"),
      apiFetch<MachineState[]>("/machines"),
      apiFetch<DriftReport>("/drift/report"),
    ]);
    setHealth(h);
    setModel(m);
    setMachines(mc ?? []);
    setDrift(d);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30_000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const isOnline = health?.status === "ok";

  return (
    <div className="min-h-screen bg-forge-black text-forge-text">
      {/* ── Nav ───────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 border-b border-forge-border bg-forge-black/90 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-md bg-forge-amber flex items-center justify-center">
                <span className="text-forge-black font-syne font-black text-xs">YG</span>
              </div>
              <span className="font-syne font-bold text-forge-text">YieldGuard</span>
            </Link>
            <span className="text-forge-border text-sm">|</span>
            <span className="font-barlow tracking-widest uppercase text-xs text-forge-muted">Live Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border font-mono ${isOnline ? "border-forge-green/40 text-forge-green bg-forge-green/10" : "border-forge-red/40 text-forge-red bg-forge-red/10"}`}>
              <StatusLight ok={loading ? null : isOnline} />
              {loading ? "Connecting…" : isOnline ? "API ONLINE" : "API OFFLINE"}
            </div>
            <button onClick={fetchAll} className="text-forge-muted hover:text-forge-text transition-colors text-xs font-barlow tracking-wider uppercase px-3 py-1.5 border border-forge-border rounded-lg hover:border-forge-amber/40">
              Refresh
            </button>
            <Link href="/demo" className="text-forge-muted hover:text-forge-text transition-colors text-xs font-barlow tracking-wider uppercase">
              Demo →
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">
        {/* ── Status banner ─────────────────────────────────────────── */}
        {!loading && !isOnline && (
          <div className="border border-forge-red/40 bg-forge-red/10 rounded-xl p-4 flex items-center gap-3">
            <span className="text-forge-red text-2xl">⚠</span>
            <div>
              <div className="font-syne font-bold text-forge-red text-sm">API Unreachable</div>
              <div className="text-forge-muted text-xs mt-0.5">
                The prediction service at <code className="font-mono">{API_URL}</code> is not responding.
                The API may be cold-starting (free tier takes ~30s). Try refreshing in a moment.
                <br />
                <Link href="/demo" className="text-forge-amber hover:underline ml-1">View interactive demo with sample data →</Link>
              </div>
            </div>
          </div>
        )}

        {/* ── Top metrics ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <MetricCard label="API Status" value={isOnline ? "ONLINE" : loading ? "..." : "OFFLINE"}
            color={isOnline ? "text-forge-green" : "text-forge-red"} sub={health?.timestamp?.slice(0, 19).replace("T", " ") ?? ""} />
          <MetricCard label="Model Loaded" value={health?.model_loaded ? "YES" : loading ? "..." : "NO"}
            color={health?.model_loaded ? "text-forge-green" : "text-forge-red"} sub={modelInfo?.model_type ?? ""} />
          <MetricCard label="Machines Tracked" value={machines.length || "—"}
            sub={`${machines.filter(m => m.buffer_status === "warm").length} warm buffers`} />
          <MetricCard label="Drift Status"
            value={drift?.overall_status?.toUpperCase() ?? (loading ? "..." : "N/A")}
            color={drift?.overall_status === "stable" ? "text-forge-green" : drift?.overall_status === "critical" ? "text-forge-red" : "text-forge-amber"}
            sub={drift?.features_drifted !== undefined ? `${drift.features_drifted} features drifted` : ""} />
        </div>

        {/* ── Model info ────────────────────────────────────────────── */}
        {modelInfo && modelInfo.status !== "not_loaded" && (
          <div className="hmi-panel p-5">
            <div className="text-forge-muted font-barlow tracking-widest uppercase text-[10px] mb-3">Active Model</div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[
                { k: "Name",      v: modelInfo.model_name },
                { k: "Type",      v: modelInfo.model_type },
                { k: "PR-AUC",    v: modelInfo.pr_auc?.toFixed(3) ?? "—" },
                { k: "ROC-AUC",   v: modelInfo.roc_auc?.toFixed(3) ?? "—" },
                { k: "Threshold", v: modelInfo.threshold?.toFixed(3) ?? "—" },
                { k: "Features",  v: modelInfo.feature_count?.toString() ?? "—" },
              ].map(s => (
                <div key={s.k}>
                  <div className="text-forge-muted text-[10px] font-barlow tracking-wider uppercase mb-0.5">{s.k}</div>
                  <div className="font-mono text-forge-text text-sm font-semibold">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Machines grid ─────────────────────────────────────────── */}
        {machines.length > 0 ? (
          <div>
            <div className="text-forge-muted font-barlow tracking-widest uppercase text-xs mb-3">Machine States ({machines.length})</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {machines.map(m => {
                const fp = m.last_prediction?.failure_probability ?? 0;
                const rl = m.last_prediction?.risk_level ?? "LOW";
                const status = (rl === "CRITICAL" ? "CRITICAL" : rl === "HIGH" ? "HIGH" : rl === "MEDIUM" ? "WARNING" : "OPERATIONAL") as "CRITICAL" | "HIGH" | "WARNING" | "OPERATIONAL";
                return (
                  <div key={m.machine_id} className="hmi-panel p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold text-forge-amber text-sm">{m.machine_id}</span>
                      <StatusBadge status={status} pulse />
                    </div>
                    <div className="flex items-center justify-center my-3">
                      <GaugeChart value={fp} size={100} label={`${(fp * 100).toFixed(0)}%`} />
                    </div>
                    <div className="text-center">
                      <div className="text-forge-muted text-[10px] font-barlow tracking-wider uppercase mb-1">
                        Buffer: <span className={m.buffer_status === "warm" ? "text-forge-green" : "text-forge-amber"}>{m.buffer_status.toUpperCase()}</span>
                      </div>
                      {m.last_prediction && (
                        <div className="text-forge-muted text-[10px] font-mono">
                          {m.last_prediction.timestamp.slice(11, 19)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : !loading && isOnline ? (
          <div className="hmi-panel p-8 text-center">
            <div className="text-forge-muted text-3xl mb-3">📡</div>
            <div className="font-syne font-bold text-forge-text text-sm mb-1">No Active Machines</div>
            <div className="text-forge-muted text-xs max-w-md mx-auto">
              No machines have submitted readings yet. Send sensor data to <code className="font-mono text-forge-amber">/predict</code> to track machines here.
            </div>
            <div className="mt-4">
              <a href={`${API_URL}/docs`} target="_blank" rel="noopener noreferrer"
                className="text-forge-amber text-xs font-barlow tracking-wider uppercase hover:underline">
                View API Docs →
              </a>
            </div>
          </div>
        ) : null}

        {/* ── Drift report ──────────────────────────────────────────── */}
        {drift && (
          <div className="hmi-panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-forge-muted font-barlow tracking-widest uppercase text-[10px]">Drift Monitor</div>
              <div className={`text-xs font-barlow font-semibold tracking-wider uppercase px-2 py-1 rounded-full border ${
                drift.overall_status === "stable" ? "text-forge-green border-forge-green/40 bg-forge-green/10" :
                drift.overall_status === "critical" ? "text-forge-red border-forge-red/40 bg-forge-red/10" :
                drift.overall_status === "unavailable" ? "text-forge-muted border-forge-muted/40" :
                "text-forge-amber border-forge-amber/40 bg-forge-amber/10"}`}>
                {drift.overall_status}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div>
                <div className="text-forge-muted font-barlow tracking-wider uppercase text-[10px] mb-0.5">Features Monitored</div>
                <div className="font-mono font-semibold text-forge-text">{drift.feature_count ?? "—"}</div>
              </div>
              <div>
                <div className="text-forge-muted font-barlow tracking-wider uppercase text-[10px] mb-0.5">Features Drifted</div>
                <div className={`font-mono font-semibold ${(drift.features_drifted ?? 0) > 0 ? "text-forge-amber" : "text-forge-green"}`}>
                  {drift.features_drifted ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-forge-muted font-barlow tracking-wider uppercase text-[10px] mb-0.5">Last Checked</div>
                <div className="font-mono text-forge-muted">{drift.timestamp?.slice(0, 19).replace("T", " ") ?? "—"}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-forge-border text-xs text-forge-muted">
              PSI &lt; 0.10 = stable · 0.10–0.20 = warning · &gt; 0.20 = critical. KS test p &lt; 0.01 triggers alert.
            </div>
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-xs text-forge-muted font-mono pt-4 border-t border-forge-border">
          <span>YieldGuard Dashboard · Auto-refreshes every 30s</span>
          <span>Last: {lastRefresh?.toLocaleTimeString() ?? "—"}</span>
          <a href={`${API_URL}/docs`} target="_blank" rel="noopener noreferrer" className="hover:text-forge-amber transition-colors">
            API Docs →
          </a>
        </div>
      </div>
    </div>
  );
}
