import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/metadata";
import { OPERATOR } from "@/lib/operator";
import { repoFileUrl } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/impressum",
  title: "Impressum",
  description: "Impressum von KontoKlar, einem privaten, nicht-kommerziellen Portfolio-Projekt von Mirkan Deniz Günkaya.",
});

export default function ImpressumPage() {
  return (
    <LegalPage title="Impressum" updated={OPERATOR.lastUpdated}>
      <LegalSection title="Verantwortlich für diese Seite">
        <p>
          {OPERATOR.name}
          <br />
          {OPERATOR.city}
        </p>
        <p>
          Kontakt:{" "}
          <a href={`mailto:${OPERATOR.email}`} className="text-moss underline">
            {OPERATOR.email}
          </a>
        </p>
        <p className="text-stone">
          Diese Seite ist ein privates, nicht-kommerzielles Portfolio- und Lernprojekt. Es werden keine Waren oder
          Dienstleistungen angeboten, es gibt keine Werbung und keine Bezahlfunktion. Kontaktaufnahme bitte per E-Mail.
        </p>
      </LegalSection>

      <LegalSection title="Haftung für Inhalte">
        <p>
          Die Inhalte dieser Seite wurden mit Sorgfalt erstellt. Für Richtigkeit, Vollständigkeit und Aktualität wird keine
          Gewähr übernommen. KontoKlar ist ein Werkzeug zur Auswertung eigener Kontoumsätze. Kategorien, wiederkehrende
          Zahlungen und die persönliche Inflationsrate sind automatische Näherungen. Sie stellen keine Finanz-, Steuer- oder
          Rechtsberatung dar. Näheres regeln die{" "}
          <Link href="/nutzungsbedingungen" className="text-moss underline">
            Nutzungsbedingungen
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Haftung für Links">
        <p>
          Diese Seite kann Links auf externe Webseiten enthalten, auf deren Inhalte kein Einfluss besteht. Für diese Inhalte
          ist stets der jeweilige Anbieter verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar.
          Bei Bekanntwerden von Rechtsverletzungen werden betroffene Links entfernt.
        </p>
      </LegalSection>

      <LegalSection title="Urheberrecht und Lizenz">
        <p>
          Der Quellcode des Projekts steht unter der{" "}
          <a href={repoFileUrl("LICENSE")} rel="noopener noreferrer" className="text-moss underline">
            MIT-Lizenz<span className="sr-only"> (externe Seite)</span>
          </a>
          . Texte und Gestaltung dieser Seite unterliegen dem deutschen
          Urheberrecht. Genannte Banken, Marken und Produktnamen (etwa DKB, ING, comdirect, N26, Volksbanken
          Raiffeisenbanken, Sparkassen) gehören ihren jeweiligen Inhabern; es besteht keine Verbindung zu diesen
          Unternehmen.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
