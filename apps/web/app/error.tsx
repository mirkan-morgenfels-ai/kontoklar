"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-wine">Fehler</p>
      <h1 className="text-3xl font-semibold tracking-tight">Etwas ist schiefgelaufen</h1>
      <p className="text-stone">Die Seite konnte nicht dargestellt werden. Deine Daten wurden dabei nicht übertragen; alles bleibt im Browser.</p>
      <div className="flex gap-4 text-sm">
        <button type="button" onClick={reset} className="rounded-md border border-ink bg-ink px-3 py-1.5 font-medium text-white hover:border-wine hover:bg-wine">
          Erneut versuchen
        </button>
        <Link href="/" className="self-center underline decoration-gold underline-offset-4 hover:text-wine">
          Zur Startseite
        </Link>
      </div>
    </main>
  );
}
