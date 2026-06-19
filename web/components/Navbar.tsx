"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { clsx } from "clsx";
import { Logo } from "./Logo";

const NAV_LINKS = [
  { href: "/",          label: "Home" },
  { href: "/demo",      label: "Demo" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/guide",     label: "Guide" },
  { href: "/about",     label: "Methodology" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  return (
    <>
      <header
        className={clsx(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "glass border-b border-cc-border"
            : "bg-transparent border-b border-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-5 md:px-8 h-[60px] flex items-center justify-between">
          {/* Logo */}
          <Logo size={28} />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Main navigation">
            {NAV_LINKS.map(({ href, label }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    "relative px-3.5 py-1.5 rounded-lg text-[13.5px] font-medium transition-colors duration-150",
                    active
                      ? "text-cc-text"
                      : "text-cc-muted hover:text-cc-text"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-lg bg-cc-raised border border-cc-border"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* CTA + mobile toggle */}
          <div className="flex items-center gap-3">
            <Link
              href="/demo"
              className="hidden md:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[13px] font-semibold font-display bg-signal-gradient text-cc-ink transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cc-healthy"
            >
              Try Demo
            </Link>
            <button
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden p-2 rounded-lg text-cc-muted hover:text-cc-text hover:bg-cc-surface transition-colors"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-cc-bg/70 backdrop-blur-sm md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.nav
              key="drawer"
              className="fixed top-[60px] left-0 right-0 z-40 glass border-b border-cc-border px-5 py-4 md:hidden"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              aria-label="Mobile navigation"
            >
              <div className="flex flex-col gap-1">
                {NAV_LINKS.map(({ href, label }) => {
                  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={clsx(
                        "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                        active
                          ? "bg-cc-raised text-cc-text border border-cc-border"
                          : "text-cc-muted hover:text-cc-text hover:bg-cc-surface"
                      )}
                    >
                      {label}
                    </Link>
                  );
                })}
                <Link
                  href="/demo"
                  className="mt-2 px-4 py-3 rounded-lg text-sm font-semibold font-display bg-signal-gradient text-cc-ink text-center"
                >
                  Try Demo
                </Link>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
