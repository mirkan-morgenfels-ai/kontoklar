import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://kontoklar-eight.vercel.app"),
  title: { default: "KontoKlar", template: "%s · KontoKlar" },
  description: "Kategorisiert Bankumsätze aus CSV-Exporten und zeigt, wohin das Geld geht. Keine Kontoanbindung, keine Speicherung.",
  openGraph: {
    title: "KontoKlar",
    description: "Bank-CSV rein, Dashboard raus. Regel-Engine zuerst, Embeddings zweitens, Sprachmodell nur als Fallback.",
    locale: "de_DE",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
