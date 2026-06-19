import Link from "next/link";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-cc-bg text-cc-text flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="font-mono text-cc-healthy text-sm tracking-widest uppercase mb-3">404</div>
          <h1 className="font-display font-bold text-3xl text-cc-text mb-3">Page not found</h1>
          <p className="text-cc-muted text-base leading-relaxed mb-8">
            This page does not exist. Try the demo or upload your sensor data.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="px-5 py-2.5 rounded-xl bg-signal-gradient text-cc-ink font-display font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Go home
            </Link>
            <Link
              href="/demo"
              className="glass-hover px-5 py-2.5 rounded-xl text-cc-text font-display font-semibold text-sm transition-all"
            >
              Try demo
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
