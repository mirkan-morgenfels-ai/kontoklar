import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-gold-deep">Portfolio</p>
        <h1 className="text-4xl font-semibold tracking-tight">Mirkan Deniz Günkaya</h1>
        <p className="text-stone">Data, Finanzen und angewandtes Machine Learning. Drei Projekte, ein Monorepo.</p>
      </header>
      <ul className="grid gap-4">
        <li className="rounded-xl border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-stone">K1</p>
          <h2 className="text-lg font-medium">DepotDoktor</h2>
          <p className="text-sm text-stone">Clientseitiger Depot-Steuer- und Performance-Analyzer. In Vorbereitung.</p>
        </li>
        <li className="rounded-xl border border-gold bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-gold-deep">K2</p>
          <h2 className="text-lg font-medium">
            <Link href="/projects/kontoklar" className="underline decoration-gold underline-offset-4 hover:text-wine">
              KontoKlar
            </Link>
          </h2>
          <p className="text-sm text-stone">Kategorisiert Bankumsätze aus CSV-Exporten und zeigt, wohin das Geld geht.</p>
        </li>
        <li className="rounded-xl border border-line bg-white p-5">
          <p className="text-xs uppercase tracking-wide text-stone">K3</p>
          <h2 className="text-lg font-medium">NetzRadar</h2>
          <p className="text-sm text-stone">Graph-basierte Anomalieerkennung. In Vorbereitung.</p>
        </li>
      </ul>
      <footer className="flex gap-4 text-sm text-stone">
        <Link href="/impressum">Impressum</Link>
        <Link href="/datenschutz">Datenschutz</Link>
      </footer>
    </main>
  );
}
