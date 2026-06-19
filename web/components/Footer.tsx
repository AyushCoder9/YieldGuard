import Link from "next/link";
import { Github, ExternalLink, Activity } from "lucide-react";
import { LogoMark } from "./Logo";

const PRODUCT_LINKS = [
  { href: "/demo",      label: "Interactive Demo" },
  { href: "/dashboard", label: "Analyze Your Data" },
  { href: "/guide",     label: "User Guide" },
];

const TECH_LINKS = [
  { href: "/about",                                          label: "Methodology" },
  { href: "https://github.com/AyushCoder9/YieldGuard",      label: "GitHub", external: true },
  { href: "https://yieldguard-api.onrender.com/docs",       label: "API Reference", external: true },
];

export function Footer() {
  return (
    <footer className="border-t border-cc-border bg-cc-surface/40">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <LogoMark size={24} />
              <span className="font-display font-bold text-cc-text text-[15px]">
                Yield<span className="text-signal">Guard</span>
              </span>
            </div>
            <p className="text-cc-muted text-sm leading-relaxed max-w-xs">
              Industrial AI that predicts machine failures 24 hours before they happen — from sensor streams.
            </p>
            <a
              href="https://github.com/AyushCoder9/YieldGuard"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 text-cc-muted hover:text-cc-text text-sm transition-colors"
            >
              <Github size={15} />
              AyushCoder9/YieldGuard
            </a>
          </div>

          {/* Product */}
          <div>
            <div className="text-cc-muted text-xs font-semibold tracking-widest uppercase mb-4">Product</div>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map(l => (
                <li key={l.href}>
                  <Link href={l.href} className="text-cc-muted hover:text-cc-text text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Tech */}
          <div>
            <div className="text-cc-muted text-xs font-semibold tracking-widest uppercase mb-4">Engineering</div>
            <ul className="space-y-2.5">
              {TECH_LINKS.map(l => (
                <li key={l.href}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-cc-muted hover:text-cc-text text-sm transition-colors"
                    >
                      {l.label}
                      <ExternalLink size={11} className="opacity-60" />
                    </a>
                  ) : (
                    <Link href={l.href} className="text-cc-muted hover:text-cc-text text-sm transition-colors">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-cc-border pt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-cc-subtle text-xs font-mono">
            v2.0.0 · LightGBM · XGBoost · Next.js 15 · Vercel
          </p>
          <div className="flex items-center gap-1.5 text-xs text-cc-muted font-mono">
            <Activity size={11} className="text-cc-healthy" />
            <span>Predictions run in-browser · No data leaves your device</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
