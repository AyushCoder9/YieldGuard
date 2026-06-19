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
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="yg-hex" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
        <linearGradient id="yg-wave" x1="8" y1="0" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#2DD4BF" />
          <stop offset="55%"  stopColor="#2DD4BF" />
          <stop offset="100%" stopColor="#6366F1" />
        </linearGradient>
      </defs>

      {/* Hexagon — industrial enclosure */}
      <polygon
        points="20,4 33.9,12 33.9,28 20,36 6.1,28 6.1,12"
        fill="rgba(45,212,191,0.07)"
        stroke="url(#yg-hex)"
        strokeWidth="1.5"
      />

      {/* Sensor trace: flat → gentle rise → spike → rapid drop → flat
          Spike = detected anomaly; dot = the 24h-ahead catch moment. */}
      <path
        d="M8 23 L13 23 L15.5 20 L19 13 L21 23 L32 23"
        stroke="url(#yg-wave)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Detection point */}
      <circle cx="19" cy="13" r="1.5" fill="url(#yg-hex)" />
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
