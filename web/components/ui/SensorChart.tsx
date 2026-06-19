"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, LineChart, Line,
} from "recharts";
import { clsx } from "clsx";

interface DataPoint {
  t: string;
  v: number;
  threshold?: number;
}

interface SensorChartProps {
  data: DataPoint[];
  color?: string;
  label?: string;
  unit?: string;
  threshold?: number;
  height?: number;
  className?: string;
  type?: "area" | "line";
  showGrid?: boolean;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs shadow-xl border border-cc-border">
      <div className="text-cc-muted font-mono mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="font-mono font-semibold" style={{ color: p.color }}>
          {typeof p.value === "number" ? p.value.toFixed(3) : p.value}
        </div>
      ))}
    </div>
  );
}

export function SensorChart({
  data,
  color = "#2DD4BF",
  label,
  unit,
  threshold,
  height = 120,
  className,
  type = "area",
  showGrid = true,
}: SensorChartProps) {
  const gradId = `sg-${label?.replace(/\s+/g, "-") ?? "default"}`;

  return (
    <div className={clsx("glass rounded-xl p-4", className)}>
      {(label || unit) && (
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ color }}>
              {label}
            </span>
            {unit && <span className="text-cc-subtle text-xs">({unit})</span>}
          </div>
          {data.length > 0 && (
            <span className="font-mono text-sm sensor-val" style={{ color }}>
              {data[data.length - 1].v?.toFixed(2)}
            </span>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        {type === "area" ? (
          <AreaChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 2 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            {showGrid && (
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" vertical={false} />
            )}
            <XAxis
              dataKey="t"
              tick={{ fontSize: 9, fill: "#3D4F63", fontFamily: "var(--font-jetbrains-mono)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#3D4F63", fontFamily: "var(--font-jetbrains-mono)" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<ChartTooltip />} />
            {threshold !== undefined && (
              <ReferenceLine
                y={threshold}
                stroke="rgba(245,165,36,0.5)"
                strokeDasharray="4 2"
                label={{ value: "2σ", position: "right", fontSize: 9, fill: "#F5A524" }}
              />
            )}
            <Area
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 2 }}>
            {showGrid && (
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" vertical={false} />
            )}
            <XAxis
              dataKey="t"
              tick={{ fontSize: 9, fill: "#3D4F63", fontFamily: "var(--font-jetbrains-mono)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#3D4F63", fontFamily: "var(--font-jetbrains-mono)" }}
              axisLine={false}
              tickLine={false}
              width={32}
            />
            <Tooltip content={<ChartTooltip />} />
            {threshold !== undefined && (
              <ReferenceLine y={threshold} stroke="rgba(245,165,36,0.5)" strokeDasharray="4 2" />
            )}
            <Line
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/* Risk probability timeline */
export function RiskTimeline({
  data,
  currentIdx,
  height = 80,
}: {
  data: { t: string; fp: number }[];
  currentIdx: number;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="risk-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#FB3B5C" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#FB3B5C" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <Area
          dataKey="fp"
          stroke="#FB3B5C"
          strokeWidth={1.5}
          fill="url(#risk-grad)"
          dot={false}
          isAnimationActive={false}
        />
        {data[currentIdx] && (
          <ReferenceLine
            x={data[currentIdx].t}
            stroke="#F5A524"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
        )}
        <YAxis domain={[0, 1]} hide />
        <XAxis dataKey="t" hide />
      </AreaChart>
    </ResponsiveContainer>
  );
}
