import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { PRIVACY_FACTS } from "@/lib/kontoklar/privacy";
import { pageMetadata } from "@/lib/metadata";
import { OPERATOR } from "@/lib/operator";

export const metadata: Metadata = pageMetadata({
  path: "/datenschutz",
  title: "Datenschutzerklärung",
  description: "Datenschutzerklärung von KontoKlar: Auswertung im Browser, optionaler API-Schritt nur mit Einwilligung, keine Cookies und kein Tracking.",
});

function formatDecimal(value: number): string {
  return value.toLocaleString("de-DE");
}

export default function DatenschutzPage() {
  const f = PRIVACY_FACTS;
  return (
    <LegalPage title="Datenschutzerklärung" updated={OPERATOR.lastUpdated}>
      <LegalSection title="1. Verantwortlicher">
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Seite im Sinne der Datenschutz-Grundverordnung (DSGVO) ist{" "}
          {OPERATOR.name}, {OPERATOR.city}. Kontakt per E-Mail:{" "}
          <a href={`mailto:${OPERATOR.email}`} className="link">
            {OPERATOR.email}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="2. Das Wichtigste in Kürze">
        <p>
          Diese Seite ist ein privates, nicht-kommerzielles Projekt. Sie verwendet keine Cookies, keine Analyse- oder
          Tracking-Dienste und keine Werbung. Hochgeladene CSV-Dateien werden nur in Ihrem Browser ausgewertet. Nur wenn Sie
          den optionalen API-Schritt nutzen, verlassen einzelne normalisierte Händlernamen den Browser (Abschnitt 4). Der
          API-Schritt steht nur zur Verfügung, wenn er auf dem Server vollständig eingerichtet ist; die Seite zeigt beim
          Upload an, ob das der Fall ist.
        </p>
      </LegalSection>

      <LegalSection title="3. KontoKlar: Verarbeitung im Browser">
        <p>
          Hochgeladene CSV-Dateien werden ausschließlich im Browser gelesen und ausgewertet. Umsätze, IBANs,
          Verwendungszwecke, Beträge und Buchungsdaten werden nicht an den Server übertragen und nicht gespeichert; was der
          optionale API-Schritt sendet, beschreibt Abschnitt 4. Das können Sie in den Entwicklerwerkzeugen Ihres Browsers
          (Netzwerk-Tab) nachvollziehen.
        </p>
      </LegalSection>

      <LegalSection title="4. KontoKlar: Optionaler API-Schritt">
        <p>
          Wenn der API-Schritt eingeschaltet ist, überträgt der Browser für Buchungen, die die Regel-Engine nicht zuordnen
          kann, ausschließlich den normalisierten Händlerteil des Buchungstexts (zum Beispiel „REWE SAGT DANKE“) an die
          Route <code>/api/categorize</code>, höchstens {f.maxTextsPerUpload} Texte je Upload, zusammen mit dem Token der
          Bot-Prüfung (Abschnitt 5). Gesendet werden höchstens bereinigte Händlernamen von Kartenzahlungen und Lastschriften
          sowie von Überweisungen und sonstigen Abbuchungen an Empfänger mit Firmenkennzeichen (etwa GmbH, AG, Versicherung).
          Bei Zahlungen über PayPal ist das der Händlername aus „Ihr Einkauf bei …“, und nur, wenn er ein Firmenkennzeichen
          trägt. Gutschriften, Überweisungen an Empfänger ohne Firmenkennzeichen, PayPal-Einkäufe bei Verkäufern ohne
          Firmenkennzeichen (etwa Privatpersonen), Buchungen ohne lesbaren Empfängernamen und Verwendungszwecke werden
          nicht gesendet. Die Erkennung ist regelbasiert; die Liste der gesendeten Texte zeigt nach jedem Upload, was den Browser
          verlassen hat.
        </p>
        <p>
          Der Server berechnet für diese Händlernamen Text-Embeddings und nur für Händlernamen, die das Beispielset nicht
          sicher zuordnet (Konfidenz unter {formatDecimal(f.fallbackBelowConfidence)}), eine Kategorie über ein Sprachmodell
          bei OpenAI (OpenAI Ireland Ltd.); es gelten die Datenverarbeitungsbedingungen des Anbieters. Das
          Ergebnis wird als Zuordnung von Händlername zu Kategorie und Konfidenz für {f.cacheDays} Tage in einer
          Redis-Datenbank bei Upstash gespeichert, damit derselbe Händlername nicht erneut angefragt werden muss. Dieser
          Eintrag enthält weder Ihre IP-Adresse noch andere Angaben über Sie.
        </p>
        <p>
          Rechtsgrundlage ist Ihre Einwilligung durch das Einschalten des Schritts (Art. 6 Abs. 1 lit. a DSGVO). Sie können
          den Schritt vor jedem Upload ausschalten und die Einwilligung damit jederzeit für die Zukunft widerrufen; dann
          arbeitet nur die Regel-Engine.
        </p>
      </LegalSection>

      <LegalSection title="5. Missbrauchsschutz für den API-Schritt">
        <p>
          <strong>Bot-Prüfung.</strong> Wenn Sie den API-Schritt nutzen, lädt die Seite das Prüf-Widget Cloudflare Turnstile
          von Cloudflare, Inc. (challenges.cloudflare.com). Cloudflare verarbeitet dabei Verbindungs- und Browserdaten,
          insbesondere Ihre IP-Adresse, um automatisierte Zugriffe zu erkennen. Zur Prüfung des Ergebnisses sendet der
          Server das Token und Ihre IP-Adresse an Cloudflare. Ohne eingeschalteten API-Schritt wird Turnstile nicht geladen.
        </p>
        <p>
          <strong>Aufruflimit.</strong> Je Tagesfenster (Kalendertag nach koordinierter Weltzeit, UTC) sind{" "}
          {f.rateLimitRequests} API-Aufrufe möglich; Aufrufe aus dem vorherigen Tagesfenster werden anteilig mitgezählt
          (gleitendes Fenster).
          Dafür bildet der Server aus Ihrer IP-Adresse mit einem geheimen Server-Schlüssel einen HMAC-SHA256-Wert (64
          Hexadezimalzeichen). Bei einer IPv6-Adresse verwendet er dafür nur die ersten {f.ipv6PrefixBits} Bit, also das
          Präfix des Netzes, aus dem Sie zugreifen; alle Geräte mit demselben Präfix teilen sich das Limit. Nur dieser Wert wird
          zusammen mit der Zahl Ihrer Aufrufe im jeweiligen Tagesfenster als Zähler bei Upstash gespeichert; die
          IP-Adresse selbst wird dort nicht gespeichert. Es handelt sich um eine Pseudonymisierung, keine Anonymisierung:
          Wer den Schlüssel kennt, könnte prüfen, ob ein Wert zu einer bestimmten IP-Adresse oder einem bestimmten
          IPv6-Präfix gehört. Der Schlüssel liegt nur in der Server-Konfiguration. Jeder Zähler wird von Upstash automatisch{" "}
          {f.rateLimitRetentionHours} Stunden und {f.rateLimitRetentionExtraSeconds} Sekunde nach dem ersten Aufruf im
          jeweiligen Tagesfenster gelöscht.
        </p>
        <p>
          Zweck ist der Schutz der Seite vor automatisierten Massenanfragen und unkontrollierten Kosten. Rechtsgrundlage ist
          Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse liegt im sicheren und wirtschaftlich tragbaren Betrieb des
          API-Schritts. Ist der Schutz nicht vollständig eingerichtet, bleibt der API-Schritt abgeschaltet; ist der Zähler
          nicht erreichbar, lehnt der Server die Anfrage ab, ohne Händlernamen an OpenAI zu senden.
        </p>
      </LegalSection>

      <LegalSection title="6. Hosting und Server-Logdaten">
        <p>
          Die Seite wird bei Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA, gehostet. Beim Aufruf der Seite
          verarbeitet Vercel technisch notwendige Daten, um die Seite auszuliefern, insbesondere IP-Adresse, Datum und Uhrzeit
          der Anfrage, aufgerufene Adresse, übertragene Datenmenge, Browsertyp und Betriebssystem sowie die verweisende Seite.
          Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; das berechtigte Interesse liegt im sicheren und stabilen Betrieb der
          Seite. Vercel verarbeitet diese Daten als Auftragsverarbeiter; die Übermittlung in die USA stützt sich auf die
          Standardvertragsklauseln der EU-Kommission und die Zertifizierung von Vercel unter dem EU-US Data Privacy Framework.
          Einzelheiten stehen in der{" "}
          <a href="https://vercel.com/legal/privacy-notice" rel="noopener noreferrer" className="link">
            Datenschutzerklärung von Vercel<span className="sr-only"> (externe Seite)</span>
          </a>
          .
        </p>
        <p>
          Der Betreiber selbst wertet diese Logdaten nicht aus. Vercel Web Analytics und Speed Insights sind nicht aktiviert.
          Die API-Route schreibt bei Fehlern nur Fehlerart und Statuscode in das Protokoll, keine Buchungstexte und keine
          IP-Adressen.
        </p>
      </LegalSection>

      <LegalSection title="7. Kontakt per E-Mail">
        <p>
          Wenn Sie per E-Mail Kontakt aufnehmen, werden die von Ihnen mitgeteilten Daten (E-Mail-Adresse, Inhalt der
          Nachricht) zur Bearbeitung der Anfrage verarbeitet (Art. 6 Abs. 1 lit. f DSGVO, bei vorvertraglichen Anfragen lit.
          b). Die Daten werden gelöscht, sobald die Anfrage erledigt ist und keine gesetzlichen Aufbewahrungspflichten
          entgegenstehen.
        </p>
      </LegalSection>

      <LegalSection title="8. Externe Links">
        <p>
          Diese Seite verlinkt auf die Projekte DepotDoktor und NetzRadar, die unter eigenen Adressen betrieben werden und
          eigene Datenschutzerklärungen haben, sowie auf die öffentlichen Quellcode-Repositories bei GitHub (GitHub, Inc.,
          USA). Erst beim Anklicken ruft Ihr Browser die fremde Seite auf; dort gilt die Datenschutzerklärung des jeweiligen
          Anbieters. Vorher werden keine Daten an diese Anbieter übertragen, und die Links übermitteln keine Herkunftsseite.
        </p>
      </LegalSection>

      <LegalSection title="9. Ihre Rechte">
        <p>
          Sie haben gegenüber dem Verantwortlichen das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16),
          Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen
          Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21). Eine Einwilligung können Sie jederzeit mit
          Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3). Außerdem können Sie sich bei einer Datenschutz-Aufsichtsbehörde
          beschweren, in Bayern beim Bayerischen Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach. Da
          keine Umsätze gespeichert werden, beschränkt sich eine Auskunft auf die oben genannten Verbindungsdaten und
          den pseudonymisierten Zähler des Aufruflimits.
        </p>
      </LegalSection>

      <LegalSection title="10. Änderungen">
        <p>
          Diese Datenschutzerklärung wird angepasst, wenn sich die Seite oder die Rechtslage ändert. Änderungen an den
          übertragenen oder gespeicherten Daten werden hier und im README-Abschnitt „Was den Browser verlässt“ dokumentiert.
          Es gilt die jeweils hier veröffentlichte Fassung.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
