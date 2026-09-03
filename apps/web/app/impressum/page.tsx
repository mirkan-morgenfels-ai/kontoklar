import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Impressum</h1>
      <div className="mt-6 space-y-4 text-sm leading-relaxed">
        <p>Angaben gemäß § 5 DDG</p>
        <p>
          Mirkan Deniz Günkaya
          <br />
          [Platzhalter: Straße und Hausnummer]
          <br />
          [Platzhalter: PLZ] München
        </p>
        <p>
          Kontakt: [Platzhalter: E-Mail-Adresse]
        </p>
        <p>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: Mirkan Deniz Günkaya, Anschrift wie oben.</p>
        <p className="text-stone">
          Diese Seite ist ein nicht-kommerzielles Portfolio-Projekt. Sie enthält keine Werbung und keine Bezahlfunktionen.
        </p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/" className="underline">
          Zurück zur Startseite
        </Link>
      </p>
    </main>
  );
}
