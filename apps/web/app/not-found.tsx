import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-gold-deep">Fehler 404</p>
      <h1 className="text-3xl font-semibold tracking-tight">Seite nicht gefunden</h1>
      <p className="text-stone">Die Adresse existiert nicht oder wurde verschoben.</p>
      <p className="text-sm">
        <Link href="/" className="underline decoration-gold underline-offset-4 hover:text-wine">
          Zur Startseite
        </Link>
      </p>
    </main>
  );
}
