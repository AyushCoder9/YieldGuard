import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "YieldGuard — Predict Machine Failures 24h in Advance",
    template: "%s | YieldGuard",
  },
  description:
    "Industrial AI that listens to your machines. Upload sensor data and get a calibrated failure probability — 24 hours before anything breaks.",
  keywords: ["predictive maintenance", "machine learning", "IIoT", "PLC", "industrial AI", "failure prediction"],
  openGraph: {
    title: "YieldGuard — Know Which Machine Will Fail Before It Does",
    description: "Upload sensor data, get a failure probability in seconds. No server, no cold starts — the model runs right here.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0F14",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-cc-bg text-cc-text antialiased">
        {children}
      </body>
    </html>
  );
}
