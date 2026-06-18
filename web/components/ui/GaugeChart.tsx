"use client";

interface GaugeProps {
  value: number; // 0–1
  size?: number;
  label?: string;
}

export function GaugeChart({ value, size = 120, label }: GaugeProps) {
  const pct = Math.max(0, Math.min(1, value));
  const r = 44;
  const cx = 60, cy = 60;
  const startAngle = -220;
  const sweep = 260;
  const angle = startAngle + sweep * pct;

  const toXY = (deg: number, radius: number) => ({
    x: cx + radius * Math.cos((deg * Math.PI) / 180),
    y: cy + radius * Math.sin((deg * Math.PI) / 180),
  });

  const arcPath = (r: number, from: number, to: number) => {
    const start = toXY(from, r);
    const end = toXY(to, r);
    const large = to - from > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
  };

  const color = pct > 0.75 ? "#FF3B5C" : pct > 0.5 ? "#F59E0B" : pct > 0.25 ? "#F0A500" : "#00C896";
  const needle = toXY(angle, r - 8);

  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      {/* Track */}
      <path
        d={arcPath(r, startAngle, startAngle + sweep)}
        fill="none" stroke="#21262D" strokeWidth="8" strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={arcPath(r, startAngle, angle)}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
      />
      {/* Needle center */}
      <circle cx={cx} cy={cy} r="4" fill={color} />
      <line
        x1={cx} y1={cy} x2={needle.x} y2={needle.y}
        stroke={color} strokeWidth="2" strokeLinecap="round"
      />
      {/* Value */}
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="14"
        fontFamily="'JetBrains Mono', monospace" fontWeight="600" fill={color}>
        {(pct * 100).toFixed(0)}%
      </text>
      {label && (
        <text x={cx} y={cy + 32} textAnchor="middle" fontSize="8"
          fontFamily="'Barlow Condensed', sans-serif" fill="#7D8590" letterSpacing="1">
          {label.toUpperCase()}
        </text>
      )}
    </svg>
  );
}
