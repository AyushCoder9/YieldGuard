import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "YieldGuard — Predictive Maintenance Platform",
    template: "%s | YieldGuard",
  },
  description:
    "AI-powered failure prediction for industrial machinery. Predict equipment failures 24 hours in advance using PLC/IoT sensor data, XGBoost, and 250+ engineered features.",
  keywords: ["predictive maintenance", "machine learning", "IIoT", "PLC", "industrial AI"],
  openGraph: {
    title: "YieldGuard — Predict Failures Before They Happen",
    description: "Industrial AI that listens to your machines and predicts failures 24h in advance.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#060911",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="bg-forge-black text-forge-text antialiased">
        {children}
      </body>
    </html>
  );
}
