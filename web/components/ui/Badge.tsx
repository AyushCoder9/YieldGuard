import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, XCircle, Minus, Info } from "lucide-react";

type BadgeVariant = "healthy" | "caution" | "danger" | "neutral" | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  pulse?: boolean;
  icon?: boolean;
  size?: "sm" | "md";
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  healthy: "badge-healthy",
  caution: "badge-caution",
  danger:  "badge-danger",
  neutral: "badge-neutral",
  info:    "bg-cc-indigo/12 text-cc-indigo border border-cc-indigo/30",
};

const ICONS: Record<BadgeVariant, React.ReactNode> = {
  healthy: <CheckCircle2 size={11} />,
  caution: <AlertTriangle size={11} />,
  danger:  <XCircle size={11} />,
  neutral: <Minus size={11} />,
  info:    <Info size={11} />,
};

const DOT_COLORS: Record<BadgeVariant, string> = {
  healthy: "bg-cc-healthy",
  caution: "bg-cc-caution",
  danger:  "bg-cc-danger",
  neutral: "bg-cc-subtle",
  info:    "bg-cc-indigo",
};

export function Badge({ variant = "neutral", children, className, dot, pulse, icon, size = "sm" }: BadgeProps) {
  const sizeClass = size === "sm"
    ? "text-[10.5px] px-2 py-0.5 gap-1"
    : "text-[12px] px-2.5 py-1 gap-1.5";

  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full font-mono font-medium tracking-wide",
        VARIANT_CLASSES[variant],
        sizeClass,
        className
      )}
    >
      {icon && ICONS[variant]}
      {dot && (
        <span className="relative flex-shrink-0">
          <span className={clsx("block w-1.5 h-1.5 rounded-full", DOT_COLORS[variant])} />
          {pulse && (
            <span className={clsx(
              "absolute inset-0 rounded-full animate-ping opacity-60",
              DOT_COLORS[variant]
            )} />
          )}
        </span>
      )}
      {children}
    </span>
  );
}

/* Convenience aliases for risk levels */
export function RiskBadge({ level, pulse }: { level: string; pulse?: boolean }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    OPERATIONAL: { variant: "healthy", label: "Operational" },
    LOW:         { variant: "healthy", label: "Low Risk" },
    MEDIUM:      { variant: "caution", label: "Medium Risk" },
    HIGH:        { variant: "caution", label: "High Risk" },
    CRITICAL:    { variant: "danger",  label: "Critical" },
    WARNING:     { variant: "caution", label: "Warning" },
    IDLE:        { variant: "neutral", label: "Idle" },
  };
  const { variant, label } = map[level?.toUpperCase()] ?? { variant: "neutral" as BadgeVariant, label: level };
  return <Badge variant={variant} dot pulse={pulse} icon>{label}</Badge>;
}
