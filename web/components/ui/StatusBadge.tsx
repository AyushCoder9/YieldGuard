"use client";
import { clsx } from "clsx";

type Status = "OPERATIONAL" | "WARNING" | "HIGH" | "CRITICAL" | "IDLE";

const MAP: Record<Status, { label: string; cls: string; dot: string }> = {
  OPERATIONAL: { label: "OPERATIONAL", cls: "badge-ok",       dot: "bg-forge-green" },
  WARNING:     { label: "WARNING",     cls: "badge-warning",  dot: "bg-forge-amber" },
  HIGH:        { label: "HIGH RISK",   cls: "badge-warning",  dot: "bg-orange-400" },
  CRITICAL:    { label: "CRITICAL",    cls: "badge-critical", dot: "bg-forge-red" },
  IDLE:        { label: "IDLE",        cls: "badge-idle",     dot: "bg-forge-muted" },
};

export function StatusBadge({ status, pulse = true }: { status: Status; pulse?: boolean }) {
  const { label, cls, dot } = MAP[status] || MAP.IDLE;
  return (
    <span className={clsx("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-barlow font-semibold tracking-widest uppercase", cls)}>
      <span className={clsx("w-1.5 h-1.5 rounded-full", dot, pulse && status !== "OPERATIONAL" && "animate-pulse")} />
      {label}
    </span>
  );
}
