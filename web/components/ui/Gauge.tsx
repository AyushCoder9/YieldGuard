"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";

interface GaugeProps {
  value: number;       // 0–1
  size?: number;
  label?: string;
  showValue?: boolean;
  animate?: boolean;
  className?: string;
}

function getRiskColor(v: number): { stroke: string; glow: string; text: string } {
  if (v < 0.30) return { stroke: "#2DD4BF", glow: "rgba(45,212,191,0.35)", text: "text-cc-healthy" };
  if (v < 0.60) return { stroke: "#F5A524", glow: "rgba(245,165,36,0.35)",  text: "text-cc-caution" };
  return              { stroke: "#FB3B5C", glow: "rgba(251,59,92,0.35)",   text: "text-cc-danger" };
}

export function Gauge({ value, size = 140, label, showValue = true, animate = true, className }: GaugeProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const { stroke, glow, text } = useMemo(() => getRiskColor(clamped), [clamped]);

  const R = (size / 2) * 0.72;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -210;
  const sweepAngle = 240;
  const arcLength = (Math.PI * R * sweepAngle) / 180;
  const circumference = 2 * Math.PI * R;

  function polarPoint(deg: number) {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + R * Math.cos(rad),
      y: cy + R * Math.sin(rad),
    };
  }

  function arcPath(startDeg: number, endDeg: number) {
    const s = polarPoint(startDeg);
    const e = polarPoint(endDeg);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const trackStart = startAngle;
  const trackEnd   = startAngle + sweepAngle;
  const fillEnd    = startAngle + sweepAngle * clamped;

  return (
    <div className={clsx("relative flex flex-col items-center", className)} aria-label={`Risk gauge: ${Math.round(clamped * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <filter id={`glow-${size}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Track */}
        <path
          d={arcPath(trackStart, trackEnd)}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={size * 0.06}
          strokeLinecap="round"
        />

        {/* Ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const deg = startAngle + sweepAngle * pct;
          const inner = polarPoint(deg);
          const outerR = R + size * 0.07;
          const outer = {
            x: cx + outerR * Math.cos((deg * Math.PI) / 180),
            y: cy + outerR * Math.sin((deg * Math.PI) / 180),
          };
          const isActive = pct <= clamped;
          return (
            <line
              key={i}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke={isActive ? stroke : "rgba(255,255,255,0.12)"}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          );
        })}

        {/* Fill arc (animated) */}
        {animate ? (
          <motion.path
            d={arcPath(trackStart, trackEnd)}
            fill="none"
            stroke={stroke}
            strokeWidth={size * 0.065}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: clamped }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            filter={`url(#glow-${size})`}
            style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
          />
        ) : (
          <path
            d={arcPath(trackStart, fillEnd)}
            fill="none"
            stroke={stroke}
            strokeWidth={size * 0.065}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${glow})` }}
          />
        )}

        {/* Center value */}
        {showValue && (
          <>
            <text
              x={cx} y={cy - 4}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={stroke}
              fontSize={size * 0.22}
              fontFamily="var(--font-jetbrains-mono)"
              fontWeight="600"
            >
              {Math.round(clamped * 100)}
            </text>
            <text
              x={cx} y={cy + size * 0.13}
              textAnchor="middle"
              fill="rgba(147,161,176,0.8)"
              fontSize={size * 0.09}
              fontFamily="var(--font-jetbrains-mono)"
            >
              %
            </text>
          </>
        )}
      </svg>

      {label && (
        <span className={clsx("text-center font-mono text-[11px] font-medium -mt-2", text)}>
          {label}
        </span>
      )}
    </div>
  );
}

/* Legacy export for backward compatibility */
export { Gauge as GaugeChart };
