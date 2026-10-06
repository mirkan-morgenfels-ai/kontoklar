import type { ReactNode } from "react";
import Link from "next/link";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-xs text-stone">Stand: {updated}</p>
      <div className="mt-8 space-y-8 text-sm leading-relaxed">{children}</div>
      <p className="mt-10 text-sm">
        <Link href="/" className="underline decoration-gold underline-offset-4 hover:text-wine">
          Zurück zur Startseite
        </Link>
      </p>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
