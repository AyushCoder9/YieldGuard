import { clsx } from "clsx";

interface StatProps {
  label: string;
  value: React.ReactNode;
  sub?: string;
  className?: string;
  valueColor?: string;
  trend?: "up" | "down" | "flat";
}

export function Stat({ label, value, sub, className, valueColor, trend }: StatProps) {
  return (
    <div className={clsx("glass rounded-xl p-4", className)}>
      <div className="text-cc-muted text-[10px] font-semibold tracking-widest uppercase mb-1.5">
        {label}
      </div>
      <div
        className={clsx("font-display font-bold text-2xl leading-none", valueColor ?? "text-cc-text")}
      >
        {value}
      </div>
      {sub && (
        <div className="text-cc-subtle text-xs mt-1 font-mono">{sub}</div>
      )}
    </div>
  );
}

interface MetricRowProps {
  label: string;
  value: string | number;
  note?: string;
  color?: string;
}

export function MetricRow({ label, value, note, color }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-cc-border last:border-0">
      <span className="text-cc-muted text-xs font-mono">
        {label}
        {note && <span className="text-cc-subtle ml-1">({note})</span>}
      </span>
      <span
        className="font-mono font-semibold text-sm"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
