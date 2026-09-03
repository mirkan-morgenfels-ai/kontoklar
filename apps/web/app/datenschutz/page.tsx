import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

export default function DatenschutzPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Datenschutzerklärung</h1>
      <div className="mt-6 space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold">Verantwortlicher</h2>
          <p>Mirkan Deniz Günkaya, [Platzhalter: Anschrift], München, [Platzhalter: E-Mail-Adresse].</p>
        </section>
        <section>
          <h2 className="font-semibold">Hosting</h2>
          <p>
            Die Seite wird bei Vercel Inc. gehostet. Beim Aufruf werden technisch notwendige Verbindungsdaten (IP-Adresse, Zeitpunkt, aufgerufene Seite, Browser) verarbeitet, um die Seite auszuliefern (Art. 6 Abs. 1 lit. f DSGVO). Es gibt kein Tracking und keine Werbe-Cookies.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">KontoKlar: Verarbeitung im Browser</h2>
          <p>
            Hochgeladene CSV-Dateien werden ausschließlich im Browser gelesen und ausgewertet. Umsätze, Namen, IBANs, Verwendungszwecke, Beträge und Buchungsdaten werden nicht an den Server übertragen und nicht gespeichert.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">KontoKlar: Optionaler API-Schritt</h2>
          <p>
            Wenn der API-Schritt eingeschaltet ist, überträgt der Browser für Buchungen, die die Regel-Engine nicht zuordnen kann, ausschließlich den normalisierten Händlerteil des Buchungstexts (zum Beispiel „REWE SAGT DANKE“) an die Route <code>/api/categorize</code>. Überweisungen an Privatpersonen sowie alle Gutschriften werden nie übertragen. Der Server berechnet dazu Text-Embeddings und in seltenen Fällen eine Kategorie über ein Sprachmodell bei OpenAI (OpenAI Ireland Ltd.); es gelten die Datenverarbeitungsbedingungen des Anbieters. Das Ergebnis wird als Zuordnung von Händlername zu Kategorie und Konfidenz für 30 Tage in einer Datenbank bei Upstash (Redis) gespeichert. Rechtsgrundlage ist die Einwilligung durch das Einschalten des Schritts (Art. 6 Abs. 1 lit. a DSGVO). Der Schritt lässt sich vor jedem Upload ausschalten; dann arbeitet nur die Regel-Engine.
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Missbrauchsschutz</h2>
          <p>
            Zum Schutz der API-Route vor automatisierten Anfragen wird Cloudflare Turnstile eingesetzt und die Zahl der Aufrufe je IP-Adresse begrenzt (30 pro Tag). Dabei verarbeitet Cloudflare Inc. Verbindungsdaten des Browsers; die IP-Adresse wird für das Limit in gehashter Form kurzzeitig bei Upstash gespeichert (Art. 6 Abs. 1 lit. f DSGVO).
          </p>
        </section>
        <section>
          <h2 className="font-semibold">Ihre Rechte</h2>
          <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde. Da keine Umsätze gespeichert werden, beschränkt sich eine Auskunft auf die oben genannten Verbindungsdaten und Cache-Einträge.</p>
        </section>
        <p className="text-stone">Stand: [Platzhalter: Datum der Veröffentlichung]. Änderungen an den übertragenen oder gespeicherten Daten werden hier und im README-Abschnitt „Was den Browser verlässt“ dokumentiert.</p>
      </div>
      <p className="mt-10 text-sm">
        <Link href="/" className="underline">
          Zurück zur Startseite
        </Link>
      </p>
    </main>
  );
}
