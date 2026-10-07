import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { pageMetadata } from "@/lib/metadata";
import { OPERATOR } from "@/lib/operator";
import { REPO_URL } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/nutzungsbedingungen",
  title: "Nutzungsbedingungen",
  description: "Nutzungsbedingungen von KontoKlar: kostenloses Lernprojekt, automatische Näherungen, keine Finanz-, Steuer- oder Rechtsberatung.",
});

export default function NutzungsbedingungenPage() {
  return (
    <LegalPage title="Nutzungsbedingungen" updated={OPERATOR.lastUpdated}>
      <LegalSection title="1. Geltungsbereich">
        <p>
          Diese Nutzungsbedingungen gelten für die Nutzung von KontoKlar sowie der zugehörigen Texte und Beispiele auf dieser
          Seite. Betreiber ist {OPERATOR.name} (siehe{" "}
          <Link href="/impressum" className="text-moss underline">
            Impressum
          </Link>
          ). Mit der Nutzung erkennen Sie diese Bedingungen an. Die Nutzung ist kostenlos; ein Vertrag über eine
          entgeltliche Leistung kommt nicht zustande.
        </p>
      </LegalSection>

      <LegalSection title="2. Zweck des Werkzeugs">
        <p>
          KontoKlar ist ein privates Portfolio- und Lernprojekt. Es ordnet Kontoumsätze aus CSV-Dateien, die Sie selbst
          bereitstellen, Kategorien zu und wertet sie zu Informationszwecken aus. Kategorien, wiederkehrende Zahlungen und
          persönliche Inflation sind automatische Näherungen. Sie ersetzen weder die Kontoauszüge Ihrer Bank noch die
          Beratung durch Steuerberater, Rechtsanwälte oder Finanzberater.
        </p>
      </LegalSection>

      <LegalSection title="3. Keine Beratung, kein Angebot">
        <p>
          Sämtliche Inhalte, Auswertungen, Kennzahlen, Texte und Beispiele stellen keine Finanz-, Steuer- oder
          Rechtsberatung dar. Sie sind keine Empfehlung für bestimmte Ausgaben, Verträge oder Finanzprodukte. Es handelt sich
          um allgemeine Informationen ohne Prüfung Ihrer persönlichen Verhältnisse. Entscheidungen, die Sie auf Grundlage
          dieser Inhalte treffen, treffen Sie eigenverantwortlich.
        </p>
      </LegalSection>

      <LegalSection title="4. Keine Gewähr für Ergebnisse">
        <p>
          Für Richtigkeit, Vollständigkeit und Aktualität der Auswertungen wird keine Gewähr übernommen. Die automatische
          Kategorisierung kann Buchungen falsch oder gar nicht zuordnen; unsichere Fälle sind zur Prüfung markiert. Die
          persönliche Inflationsrate ist eine Näherung auf Ebene der Abteilungen des Verbraucherpreisindex; solange die Seite
          darauf hinweist, beruht sie auf Beispielwerten. Die CSV-Formate der Banken können sich jederzeit ändern; KontoKlar
          kann dann fehlerhafte oder keine Ergebnisse liefern. KontoKlar wird ohne Zusicherung einer bestimmten
          Verfügbarkeit bereitgestellt und kann jederzeit geändert oder eingestellt werden.
        </p>
      </LegalSection>

      <LegalSection title="5. Haftung">
        <p>
          Der Betreiber haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit sowie
          für Schäden, die auf Vorsatz oder grober Fahrlässigkeit beruhen. Im Übrigen ist die Haftung ausgeschlossen. Da die
          Nutzung unentgeltlich erfolgt, haftet der Betreiber für sonstige Schäden nur, soweit er einen Mangel arglistig
          verschwiegen hat (§§ 521, 599 BGB entsprechend). Insbesondere wird nicht gehaftet für Vermögensschäden oder
          entgangenen Gewinn, die aus der Verwendung der Auswertungen entstehen.
        </p>
      </LegalSection>

      <LegalSection title="6. Ihre Daten">
        <p>
          Die Verarbeitung erfolgt im Browser; ein optionaler API-Schritt sendet nur pseudonymisierte Händlernamen
          (Einzelheiten in der{" "}
          <Link href="/datenschutz" className="text-moss underline">
            Datenschutzerklärung
          </Link>
          ). Eine automatisierte oder missbräuchliche Nutzung des API-Schritts ist nicht gestattet. Sie sind selbst dafür
          verantwortlich, dass Sie zur Nutzung der hochgeladenen Daten berechtigt sind.
        </p>
      </LegalSection>

      <LegalSection title="7. Quellcode und Lizenz">
        <p>
          Der Quellcode steht unter der MIT-Lizenz und ist öffentlich auf{" "}
          <a href={REPO_URL} rel="noopener noreferrer" className="text-moss underline">
            GitHub<span className="sr-only"> (externe Seite)</span>
          </a>{" "}
          verfügbar. Die Lizenz enthält einen eigenen Haftungs- und Gewährleistungsausschluss, der für die Nutzung des
          Quellcodes gilt.
        </p>
      </LegalSection>

      <LegalSection title="8. Schlussbestimmungen">
        <p>
          Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne Bestimmungen unwirksam sein, bleibt die
          Wirksamkeit der übrigen Bestimmungen unberührt. Der Betreiber kann diese Bedingungen mit Wirkung für die Zukunft
          ändern; es gilt die jeweils hier veröffentlichte Fassung.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
