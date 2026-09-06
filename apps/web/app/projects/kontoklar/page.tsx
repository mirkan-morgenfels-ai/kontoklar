import type { Metadata } from "next";
import Link from "next/link";
import { KontoKlarApp } from "./components/KontoKlarApp";

export const metadata: Metadata = {
  title: "Bankumsätze kategorisieren",
  description: "Kategorisiert Bankumsätze aus CSV-Exporten von DKB, ING, comdirect und N26. Keine Kontoanbindung, keine Speicherung.",
};

export default function KontoKlarPage() {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold-deep">K2 · Portfolio</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">KontoKlar</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone">
            Bank-CSV rein, Dashboard raus. Regel-Engine zuerst, Embeddings zweitens, Sprachmodell nur als Fallback. Keine Kontoanbindung, keine Speicherung von Umsätzen.
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-stone">
          <Link href="/" className="hover:text-ink">Start</Link>
          <Link href="/datenschutz" className="hover:text-ink">Datenschutz</Link>
          <Link href="/impressum" className="hover:text-ink">Impressum</Link>
        </nav>
      </header>
      <KontoKlarApp turnstileSiteKey={turnstileSiteKey} />
      <footer className="mt-12 border-t border-line pt-4 text-xs text-stone">
        KontoKlar ist ein Werkzeug zur Auswertung eigener Daten und stellt keine Finanz- oder Steuerberatung dar. Alle Angaben ohne Gewähr.
      </footer>
    </main>
  );
}
