import React from "react";
import { clsx } from "clsx";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: "healthy" | "caution" | "danger" | "signal" | "none";
  padding?: string;
  as?: keyof React.JSX.IntrinsicElements;
}

export function GlassPanel({
  children,
  className,
  hover = false,
  glow = "none",
  padding = "p-5",
  as: Tag = "div",
}: GlassPanelProps) {
  const glowClass = {
    healthy: "shadow-healthy-glow border-cc-healthy/20",
    caution: "shadow-caution-glow border-cc-caution/20",
    danger:  "shadow-danger-glow border-cc-danger/20",
    signal:  "shadow-signal-glow border-cc-healthy/20",
    none:    "",
  }[glow];

  return (
    <Tag
      className={clsx(
        "glass rounded-xl",
        padding,
        hover && "glass-hover cursor-default",
        glowClass,
        className
      )}
    >
      {children}
    </Tag>
  );
}
