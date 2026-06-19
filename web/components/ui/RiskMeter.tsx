"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";
import { Gauge } from "./Gauge";
import { RiskBadge } from "./Badge";

interface RiskMeterProps {
  probability: number;
  riskLevel: string;
  confidence?: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const RISK_MESSAGES: Record<string, { headline: string; body: string }> = {
  LOW:         { headline: "Machine is healthy", body: "No failure predicted in the next 24 hours. Continue normal monitoring." },
  OPERATIONAL: { headline: "Machine is healthy", body: "All sensors within normal bounds. No action required." },
  MEDIUM:      { headline: "Early warning signs", body: "Some sensor trends are unusual. Schedule a maintenance inspection soon." },
  HIGH:        { headline: "High failure risk", body: "Multiple sensors show degradation. Schedule maintenance within 24 hours." },
  CRITICAL:    { headline: "Failure likely", body: "Failure expected within 24 hours. Immediate maintenance required." },
  WARNING:     { headline: "Early warning signs", body: "Some sensor trends are unusual. Schedule a maintenance inspection soon." },
};

function getRiskColor(level: string) {
  const l = level?.toUpperCase();
  if (l === "CRITICAL") return "#FB3B5C";
  if (l === "HIGH" || l === "WARNING") return "#F5A524";
  if (l === "MEDIUM") return "#F5A524";
  return "#2DD4BF";
}

export function RiskMeter({ probability, riskLevel, confidence, className, size = "md" }: RiskMeterProps) {
  const level = riskLevel?.toUpperCase() ?? "LOW";
  const message = RISK_MESSAGES[level] ?? RISK_MESSAGES.LOW;
  const color = getRiskColor(level);
  const gaugeSize = size === "lg" ? 200 : size === "md" ? 160 : 120;

  return (
    <div className={clsx("flex flex-col items-center gap-4", className)}>
      <Gauge value={probability} size={gaugeSize} animate />

      <div className="text-center">
        <RiskBadge level={riskLevel} pulse={level === "CRITICAL" || level === "HIGH"} />

        <motion.p
          key={riskLevel}
          className="mt-3 font-display font-semibold text-cc-text"
          style={{ fontSize: size === "lg" ? "1.125rem" : "0.9375rem" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {message.headline}
        </motion.p>

        <motion.p
          key={riskLevel + "-body"}
          className="mt-1 text-cc-muted text-sm leading-relaxed max-w-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {message.body}
        </motion.p>

        {confidence !== undefined && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-cc-subtle text-xs font-mono">Confidence</span>
            <div className="flex-1 max-w-[80px] h-1 bg-cc-raised rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: color }}
                initial={{ width: 0 }}
                animate={{ width: `${confidence * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <span className="text-xs font-mono" style={{ color }}>
              {Math.round(confidence * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
