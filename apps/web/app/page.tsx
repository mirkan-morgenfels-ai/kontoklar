import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-gold-deep">Portfolio</p>
        <h1 className="text-4xl font-semibold tracking-tight">Mirkan Deniz Günkaya</h1>
        <p className="text-stone">Data, Finanzen und angewandtes Machine Learning. Drei Projekte mit eigenem Repository.</p>
      </header>
      <ul className="grid gap-4">
        <li className="rounded-xl border border-line bg-white p-5" data-testid="project-depotdoktor">
          <p className="text-xs uppercase tracking-wide text-stone">K1</p>
          <h2 className="text-lg font-medium">
            <a
              href="https://ai-project-1-web.vercel.app/projects/depotdoktor"
              rel="noopener noreferrer"
              className="underline decoration-gold underline-offset-4 hover:text-wine"
            >
              DepotDoktor
            </a>{" "}
            <span className="text-sm font-normal text-stone">(externe Seite)</span>
          </h2>
          <p className="text-sm text-stone">Depot-Steuer- und Performance-Analyzer für Broker-CSV-Exporte. Die Auswertung läuft vollständig im Browser.</p>
        </li>
        <li className="rounded-xl border border-gold bg-white p-5" data-testid="project-kontoklar">
          <p className="text-xs uppercase tracking-wide text-gold-deep">K2</p>
          <h2 className="text-lg font-medium">
            <Link href="/projects/kontoklar" className="underline decoration-gold underline-offset-4 hover:text-wine">
              KontoKlar
            </Link>
          </h2>
          <p className="text-sm text-stone">Kategorisiert Bankumsätze aus CSV-Exporten und zeigt, wohin das Geld geht.</p>
        </li>
        <li className="rounded-xl border border-line bg-white p-5" data-testid="project-netzradar">
          <p className="text-xs uppercase tracking-wide text-stone">K3</p>
          <h2 className="text-lg font-medium">NetzRadar</h2>
          <p className="text-sm text-stone">Graph-basierte Anomalie-Erkennung in Transaktionsnetzwerken. In Arbeit.</p>
        </li>
      </ul>
      <footer className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone">
        <span>© 2026 Mirkan Deniz Günkaya · Privates, nicht-kommerzielles Projekt · Quellcode unter MIT-Lizenz</span>
        <nav aria-label="Rechtliches" className="flex gap-4">
          <Link href="/impressum" className="hover:text-ink">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-ink">
            Datenschutz
          </Link>
        </nav>
      </footer>
    </main>
  );
}
