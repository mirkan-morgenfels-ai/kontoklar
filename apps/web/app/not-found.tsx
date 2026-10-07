import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Seite nicht gefunden",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col justify-center gap-4 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-gold-deep">Fehler 404</p>
      <h1 className="font-serif text-3xl hyphens-auto break-words">Seite nicht gefunden</h1>
      <p className="text-stone">Die aufgerufene Adresse existiert nicht oder wurde verschoben.</p>
      <p className="text-sm">
        <Link href="/" className="underline decoration-gold underline-offset-4 hover:text-gold-deep">
          Zur Startseite
        </Link>
      </p>
    </section>
  );
}
