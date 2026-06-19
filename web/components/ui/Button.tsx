import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import Link from "next/link";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  "aria-label"?: string;
}

const BASE = "inline-flex items-center justify-center gap-2 font-display font-semibold rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-healthy focus-visible:ring-offset-2 focus-visible:ring-offset-cc-bg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:   "bg-signal-gradient text-cc-ink hover:opacity-90 active:scale-[0.98]",
  secondary: "bg-cc-surface border border-cc-border text-cc-text hover:border-cc-border-strong hover:bg-cc-raised active:scale-[0.98]",
  ghost:     "text-cc-muted hover:text-cc-text hover:bg-cc-surface active:scale-[0.98]",
  danger:    "bg-danger-gradient text-white hover:opacity-90 active:scale-[0.98]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "text-[12px] px-3 py-1.5 gap-1.5",
  md: "text-[13.5px] px-4 py-2",
  lg: "text-[15px] px-6 py-2.5",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
  loading,
  href,
  external,
  onClick,
  type = "button",
  "aria-label": ariaLabel,
}: ButtonProps) {
  const classes = clsx(BASE, VARIANTS[variant], SIZES[size], className);
  const content = (
    <>
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </>
  );

  if (href) {
    if (external) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={classes} aria-label={ariaLabel}>
          {content}
        </a>
      );
    }
    return <Link href={href} className={classes} aria-label={ariaLabel}>{content}</Link>;
  }

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {content}
    </button>
  );
}
