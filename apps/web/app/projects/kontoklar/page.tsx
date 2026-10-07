import type { Metadata } from "next";
import accuracyJson from "../../../../../docs/genauigkeit.json";
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

const EXTERNAL_LINK_CLASS = "underline underline-offset-2 hover:text-gold-deep";

export default async function KontoKlarPage() {
  const project = PROJECTS.find((p) => p.slug === "kontoklar");
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  const figures = ruleEngineFigures(accuracyJson);
  const apiStageReady = readApiConfig().ok && (await loadLabeledVectors()).length > 0;
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="max-w-3xl">
          <p className="text-xs uppercase tracking-widest text-gold-deep">{project?.kicker ?? "Projekt K2"}</p>
          <h1 className="mt-1 font-serif text-4xl">KontoKlar</h1>
          <p className="mt-2 text-sm text-stone">
            Bank-CSV rein, Dashboard raus. Regel-Engine zuerst, Embeddings zweitens, Sprachmodell nur als Fallback. Keine
            Kontoanbindung, keine Speicherung von Umsätzen.
          </p>
          <p className="mt-3 text-sm" data-testid="pipeline-status">
            {apiStageReady
              ? "Auf dieser Instanz aktiv: Regel-Engine im Browser. Die Embedding- und Sprachmodell-Stufe ist eingerichtet und lässt sich beim Upload zuschalten."
              : "Auf dieser Instanz aktiv: Regel-Engine im Browser. Embedding- und Sprachmodell-Stufe sind implementiert und mit Mocks getestet, aber noch nicht freigeschaltet."}
          </p>
          <p className="mt-1 text-sm text-stone" data-testid="rule-figures">
            Regel-Engine auf {figures.total} synthetischen Testbuchungen: {formatPercent(figures.ruleCoverage, 1)} Abdeckung,{" "}
            {formatPercent(figures.accuracyAssigned, 1)} der zugeordneten richtig (Testset parallel zu den Regeln erstellt).{" "}
            <a href={repoFileUrl("docs/genauigkeit.md")} rel="noopener noreferrer" className={EXTERNAL_LINK_CLASS} data-testid="accuracy-doc-link">
              Messung und Fehlerliste<span className="sr-only"> (externe Seite)</span>
            </a>
          </p>
        </div>
        <a href={REPO_URL} rel="noopener noreferrer" className={`text-sm text-moss ${EXTERNAL_LINK_CLASS}`} data-testid="project-repo-link">
          Quellcode auf GitHub <span className="text-stone">(externe Seite)</span>
        </a>
      </section>
      <KontoKlarApp turnstileSiteKey={turnstileSiteKey} cacheDays={PRIVACY_FACTS.cacheDays} />
      <p className="border-t border-line pt-4 text-xs text-stone">
        KontoKlar ist ein Werkzeug zur Auswertung eigener Daten und stellt keine Finanz- oder Steuerberatung dar. Alle Angaben
        ohne Gewähr.
      </p>
    </div>
  );
}
