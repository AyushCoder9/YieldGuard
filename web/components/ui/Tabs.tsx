"use client";

import { motion } from "framer-motion";
import { clsx } from "clsx";

interface Tab<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
  variant?: "underline" | "pill";
}

export function Tabs<T extends string>({ tabs, active, onChange, className, variant = "underline" }: TabsProps<T>) {
  if (variant === "pill") {
    return (
      <div className={clsx("flex items-center gap-1 p-1 glass rounded-xl", className)}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={clsx(
              "relative flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-healthy",
              active === tab.id ? "text-cc-text" : "text-cc-muted hover:text-cc-text"
            )}
          >
            {active === tab.id && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-lg bg-cc-raised border border-cc-border"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={clsx("flex items-center gap-0 border-b border-cc-border", className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={clsx(
            "relative flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold tracking-wide uppercase transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-healthy border-b-2 -mb-px",
            active === tab.id
              ? "text-cc-healthy border-cc-healthy"
              : "text-cc-muted border-transparent hover:text-cc-text"
          )}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
