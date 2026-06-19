"use client";

import Link from "next/link";
import { clsx } from "clsx";

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-signal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="logo-shield-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2DD4BF" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      {/* Shield */}
      <path
        d="M16 2.5L4.5 7.5V15.5C4.5 21.8 9.5 27.5 16 29.2C22.5 27.5 27.5 21.8 27.5 15.5V7.5L16 2.5Z"
        fill="url(#logo-shield-fill)"
        stroke="url(#logo-signal)"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      {/* Heartbeat / sensor pulse */}
      <path
        d="M8 16 H10.5 L12.5 11.5 L15 20.5 L17.5 12.5 L19.5 16 H24"
        stroke="url(#logo-signal)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 32, showWordmark = true, className }: LogoProps) {
  return (
    <Link
      href="/"
      className={clsx("flex items-center gap-2.5 group focus-visible:outline-none", className)}
      aria-label="YieldGuard — home"
    >
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className="font-display font-bold text-cc-text tracking-tight text-[17px] leading-none"
          style={{ letterSpacing: "-0.01em" }}
        >
          Yield<span className="text-signal">Guard</span>
        </span>
      )}
    </Link>
  );
}
