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
        forge: {
          black:   "#060911",
          surface: "#0D1117",
          raised:  "#161B22",
          border:  "#21262D",
          amber:   "#F0A500",
          "amber-dim": "#7D5500",
          "amber-glow": "#F0A50020",
          green:   "#00C896",
          "green-dim": "#005C46",
          red:     "#FF3B5C",
          "red-dim": "#7A1229",
          blue:    "#58A6FF",
          text:    "#E6EDF3",
          muted:   "#7D8590",
          subtle:  "#30363D",
        },
      },
      fontFamily: {
        syne:    ["var(--font-syne)", "sans-serif"],
        barlow:  ["var(--font-barlow)", "sans-serif"],
        dm:      ["var(--font-dm)", "sans-serif"],
        mono:    ["var(--font-mono)", "monospace"],
      },
      animation: {
        "wave":        "wave 4s ease-in-out infinite",
        "pulse-slow":  "pulse 3s ease-in-out infinite",
        "scan":        "scan 8s linear infinite",
        "float":       "float 6s ease-in-out infinite",
        "ticker":      "ticker 0.4s ease-out forwards",
        "glow-pulse":  "glowPulse 2s ease-in-out infinite",
        "slide-up":    "slideUp 0.6s ease-out forwards",
        "fade-in":     "fadeIn 0.5s ease-out forwards",
      },
      keyframes: {
        wave: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        scan: {
          "0%":   { transform: "translateY(-100%)", opacity: "0.05" },
          "100%": { transform: "translateY(100vh)", opacity: "0.05" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 20px #F0A50030" },
          "50%": { boxShadow: "0 0 40px #F0A50060, 0 0 80px #F0A50020" },
        },
        slideUp: {
          "0%": { transform: "translateY(30px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      backgroundImage: {
        "grid-forge": `linear-gradient(rgba(48,54,61,0.4) 1px, transparent 1px),
                       linear-gradient(90deg, rgba(48,54,61,0.4) 1px, transparent 1px)`,
        "amber-gradient": "linear-gradient(135deg, #F0A500, #F59E0B, #D97706)",
        "danger-gradient": "linear-gradient(135deg, #FF3B5C, #EF4444)",
        "hero-radial": "radial-gradient(ellipse 80% 50% at 50% -20%, #F0A50015 0%, transparent 60%)",
      },
    },
  },
  plugins: [],
};

export default config;
