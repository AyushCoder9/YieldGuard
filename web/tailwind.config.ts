import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cc: {
          bg:            "#0B0F14",
          surface:       "#11161D",
          "surface-2":   "#171E28",
          raised:        "#1D2535",
          border:        "rgba(255,255,255,0.08)",
          "border-strong": "rgba(255,255,255,0.16)",
          healthy:       "#2DD4BF",
          "healthy-dim": "#0D3D38",
          caution:       "#F5A524",
          "caution-dim": "#3D2A09",
          danger:        "#FB3B5C",
          "danger-dim":  "#3D0E1A",
          signal:        "#2DD4BF",
          indigo:        "#6366F1",
          text:          "#E6EDF3",
          muted:         "#93A1B0",
          subtle:        "#3D4F63",
          ink:           "#0B0F14",
        },
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        sans:    ["var(--font-inter)", "sans-serif"],
        mono:    ["var(--font-jetbrains-mono)", "monospace"],
      },
      backgroundImage: {
        "signal-gradient":  "linear-gradient(135deg, #2DD4BF, #6366F1)",
        "signal-gradient-h":"linear-gradient(90deg, #2DD4BF, #6366F1)",
        "caution-gradient": "linear-gradient(135deg, #F5A524, #FB923C)",
        "danger-gradient":  "linear-gradient(135deg, #FB3B5C, #EF4444)",
        "hero-radial":      "radial-gradient(ellipse 70% 50% at 60% 20%, rgba(45,212,191,0.08) 0%, transparent 70%)",
        "grid-cc":          `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                             linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
      },
      boxShadow: {
        glass:         "inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)",
        "glass-hover": "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.5)",
        "healthy-glow":"0 0 20px rgba(45,212,191,0.25)",
        "caution-glow":"0 0 20px rgba(245,165,36,0.25)",
        "danger-glow": "0 0 20px rgba(251,59,92,0.25)",
        "signal-glow": "0 0 30px rgba(45,212,191,0.2), 0 0 60px rgba(99,102,241,0.1)",
      },
      animation: {
        "pulse-slow":     "pulse 3s ease-in-out infinite",
        "glow-healthy":   "glowHealthy 2s ease-in-out infinite",
        "glow-caution":   "glowCaution 2s ease-in-out infinite",
        "glow-danger":    "glowDanger 2s ease-in-out infinite",
        "scan-line":      "scanLine 8s linear infinite",
        "float":          "float 6s ease-in-out infinite",
        "aurora":         "aurora 12s ease infinite alternate",
        "ticker":         "ticker 0.4s ease-out forwards",
        "shimmer":        "shimmer 1.5s linear infinite",
        "wave-scroll":    "waveScroll 16s linear infinite",
        "fade-in":        "fadeIn 0.4s ease-out forwards",
        "slide-up":       "slideUp 0.5s ease-out forwards",
      },
      keyframes: {
        glowHealthy: {
          "0%,100%": { boxShadow: "0 0 12px rgba(45,212,191,0.2)" },
          "50%":     { boxShadow: "0 0 28px rgba(45,212,191,0.5)" },
        },
        glowCaution: {
          "0%,100%": { boxShadow: "0 0 12px rgba(245,165,36,0.2)" },
          "50%":     { boxShadow: "0 0 28px rgba(245,165,36,0.5)" },
        },
        glowDanger: {
          "0%,100%": { boxShadow: "0 0 12px rgba(251,59,92,0.2)" },
          "50%":     { boxShadow: "0 0 28px rgba(251,59,92,0.5)" },
        },
        scanLine: {
          "0%":   { transform: "translateY(-100%)", opacity: "0.04" },
          "100%": { transform: "translateY(100vh)", opacity: "0.04" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%":     { transform: "translateY(-10px)" },
        },
        aurora: {
          "0%":   { backgroundPosition: "0% 50%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        waveScroll: {
          "0%":   { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
