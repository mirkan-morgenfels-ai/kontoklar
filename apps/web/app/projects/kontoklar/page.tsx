import type { Metadata } from "next";
import Link from "next/link";
import accuracyJson from "../../../../../docs/genauigkeit.json";
import { ArrowMark, ExternalMark } from "@/components/site/ExternalMark";
import { BUTTON_GOLD, BUTTON_OUTLINE_LIGHT } from "@/components/site/buttons";
import { HeroOrnament } from "@/components/site/motif";
import { ProjectHero, type HeroFact } from "@/components/site/ProjectHero";
import { SectionHeader } from "@/components/site/SectionHeader";
import { Shell } from "@/components/site/Shell";
import { ruleEngineFigures } from "@/lib/kontoklar/accuracy";
import { formatPercent } from "@/lib/kontoklar/analytics";
import { readApiConfig } from "@/lib/kontoklar/config";
import { PRIVACY_FACTS } from "@/lib/kontoklar/privacy";
import { loadLabeledVectors } from "@/lib/kontoklar/providers";
import { pageMetadata } from "@/lib/metadata";
import { PROJECTS, REPO_URL, repoFileUrl } from "@/lib/site";
import { KontoKlarApp } from "./components/KontoKlarApp";

export const metadata: Metadata = pageMetadata({
  path: "/projects/kontoklar",
  title: "KontoKlar – Bankumsätze kategorisieren",
  absoluteTitle: true,
  description:
    "Kategorisiert Bankumsätze aus CSV-Exporten von DKB, ING, comdirect, N26, VR-Bank (Volksbanken und Raiffeisenbanken) und Sparkasse; andere Banken über eine Spaltenzuordnung. Keine Kontoanbindung, keine Speicherung von Umsätzen.",
});

const FACTS: readonly HeroFact[] = [
  { value: "6", label: "Banken erkannt", detail: "DKB, ING, comdirect, N26, VR-Bank und Sparkasse" },
  { value: "3", label: "Stufen", detail: "Regel-Engine, Embedding-kNN, Sprachmodell als Fallback" },
  { value: "0", label: "Umsätze gespeichert", detail: "Die CSV-Datei wird im Browser ausgewertet" },
];

const PRINCIPLES = [
  {
    title: "Regel-Engine zuerst",
    text: "Bekannte Händler ordnet ein Regelsatz im Browser zu. Erst danach folgen Embeddings und, nur bei geringer Konfidenz, ein Sprachmodell.",
  },
  {
    title: "Offen gemessen",
    text: "Abdeckung und Trefferquote stammen aus einem gelabelten, synthetischen Testset; die Fehlerliste ist öffentlich.",
  },
  {
    title: "Datensparsam",
    text: "Ohne API-Schritt verlässt nichts den Browser. Ein E2E-Test prüft den Netzwerkverkehr bei jeder Änderung.",
  },
  {
    title: "Fail-closed",
    text: "Der API-Schritt läuft nur, wenn alle Schlüssel gesetzt sind. Sonst antwortet der Server mit 503, ohne OpenAI aufzurufen.",
  },
] as const;

const PILL_LINK =
  "inline-flex items-center rounded-full border border-line-strong bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-ink";

export default async function KontoKlarPage() {
  const project = PROJECTS.find((p) => p.slug === "kontoklar");
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const figures = ruleEngineFigures(accuracyJson);
  const apiStageReady = readApiConfig().ok && (await loadLabeledVectors()).length > 0;
  return (
    <>
      <ProjectHero
        eyebrow={`${project?.kicker ?? "Projekt 02"} · ${project?.topic ?? "Maschinelles Lernen"}`}
        title={
          <>
            Konto<em className="text-gold-light">Klar</em>
          </>
        }
        tagline="Bankumsätze aus CSV-Exporten kategorisieren"
        lead={
          <p>
            Bank-CSV rein, Dashboard raus. Regel-Engine zuerst, dann Embeddings, ein Sprachmodell nur als Fallback. Keine
            Kontoanbindung, keine Speicherung von Umsätzen.
          </p>
        }
        actions={
          <>
            <a href="#analyse" className={BUTTON_GOLD}>
              Analyse starten
              <ArrowMark />
            </a>
            <a href={REPO_URL} rel="noopener noreferrer" className={BUTTON_OUTLINE_LIGHT}>
              Quellcode<span className="sr-only"> auf GitHub (externe Seite)</span>
              <ExternalMark className="ml-2 h-2.5 w-2.5 text-gold-light" />
            </a>
          </>
        }
        note={
          <div className="space-y-2 border-l border-gold/60 pl-4 text-sm leading-relaxed text-navy-300">
            <p className="text-navy-300">
              <span className="eyebrow mr-2 align-[0.1em]">Status</span>
              <span data-testid="pipeline-status">
                {apiStageReady
                  ? "Auf dieser Instanz aktiv: Regel-Engine im Browser. Die Embedding- und Sprachmodell-Stufe ist eingerichtet und lässt sich beim Upload zuschalten."
                  : "Auf dieser Instanz aktiv: Regel-Engine im Browser. Embedding- und Sprachmodell-Stufe sind implementiert und mit Mocks getestet, aber noch nicht freigeschaltet."}
              </span>
            </p>
            <p data-testid="rule-figures">
              Regel-Engine auf {figures.total} synthetischen Testbuchungen: {formatPercent(figures.ruleCoverage, 1)} Abdeckung,{" "}
              {formatPercent(figures.accuracyAssigned, 1)} der zugeordneten richtig (Testset parallel zu den Regeln erstellt).{" "}
              <a href={repoFileUrl("docs/genauigkeit.md")} rel="noopener noreferrer" className="link text-ivory" data-testid="accuracy-doc-link">
                Messung und Fehlerliste<span className="sr-only"> (externe Seite)</span>
              </a>
            </p>
          </div>
        }
        facts={FACTS}
        ornament={<HeroOrnament idPrefix="project-ornament" className="h-auto w-full" />}
      />

      <section id="analyse" aria-labelledby="analyse-title" className="scroll-mt-28 pt-12 pb-16 sm:py-20 lg:py-24">
        <Shell>
          <SectionHeader
            id="analyse-title"
            eyebrow="Analyse"
            title={
              <>
                Ihre Kontoumsätze <em>auswerten</em>
              </>
            }
            lead="Ziehen Sie den CSV-Export Ihrer Bank in das Feld oder probieren Sie die Beispieldaten aus. Kategorien, Dashboard und Inflationsrate entstehen in Ihrem Browser."
          />
          <div className="mt-10 lg:mt-12">
            <KontoKlarApp turnstileSiteKey={turnstileSiteKey} cacheDays={PRIVACY_FACTS.cacheDays} />
          </div>
        </Shell>
      </section>

      <section className="border-t border-line bg-surface py-16 sm:py-20 lg:py-24" data-testid="about-project" aria-labelledby="about-title">
        <Shell>
          <SectionHeader
            id="about-title"
            eyebrow="Hintergrund"
            title="Über das Projekt"
            lead="Ein privates Portfolio-Projekt: Kategorisierung mit nachvollziehbarer Quelle je Buchung, gemessener Genauigkeit und möglichst wenig Daten auf dem Server."
            aside={
              <div className="flex flex-wrap gap-3">
                <a href={REPO_URL} rel="noopener noreferrer" className={PILL_LINK} data-testid="project-repo-link">
                  Quellcode auf GitHub<span className="sr-only"> (externe Seite)</span>
                  <ExternalMark className="ml-2 h-2.5 w-2.5 text-gold-deep" />
                </a>
                <a href={repoFileUrl("docs/genauigkeit.md")} rel="noopener noreferrer" className={PILL_LINK}>
                  Genauigkeit<span className="sr-only"> auf GitHub (externe Seite)</span>
                  <ExternalMark className="ml-2 h-2.5 w-2.5 text-gold-deep" />
                </a>
              </div>
            }
          />
          <ol className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {PRINCIPLES.map((principle, index) => (
              <li key={principle.title} className="flex flex-col bg-surface p-6 sm:p-7">
                <span aria-hidden="true" className="display num text-[2rem] leading-none text-gold-deep">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-5 text-[0.9375rem] font-medium text-ink">{principle.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate">{principle.text}</p>
              </li>
            ))}
          </ol>
        </Shell>
      </section>

      <section aria-label="Rechtliche Hinweise" className="border-t border-line py-10">
        <Shell className="text-[13px] leading-relaxed text-slate">
          <div className="max-w-[72ch] space-y-2">
            <p>
              KontoKlar ist ein Werkzeug zur Auswertung eigener Daten und stellt keine Finanz- oder Steuerberatung dar. Alle
              Angaben ohne Gewähr.
            </p>
            <p>
              Mit der Nutzung erkennen Sie die{" "}
              <Link href="/nutzungsbedingungen" className="link">
                Nutzungsbedingungen
              </Link>{" "}
              an. Einzelheiten zur Verarbeitung Ihrer Daten stehen in der{" "}
              <Link href="/datenschutz" className="link">
                Datenschutzerklärung
              </Link>
              .
            </p>
          </div>
        </Shell>
      </section>
    </>
  );
}
