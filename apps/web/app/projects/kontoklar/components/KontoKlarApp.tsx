"use client";

import { useCallback, useState } from "react";
import { SUPPORTED_BANKS, type Bank, type ParseResult } from "@portfolio/csv";
import type { Category } from "@/lib/kontoklar/categories";
import { apiErrorText, applyManualToSameMerchant, applyRules, callCategorizeApi, collectApiCandidates, collectApiTexts, mergeApiResults, setManualCategory, summarize } from "@/lib/kontoklar/categorize";
import { MAX_TEXTS_PER_CALL } from "@/lib/kontoklar/types";
import type { CategorizedTransaction } from "@/lib/kontoklar/types";
import { autoAssignedShare, formatPercent } from "@/lib/kontoklar/analytics";
import { Dashboard } from "./Dashboard";
import { ReviewTable } from "./ReviewTable";
import { UploadPanel, type UploadOptions } from "./UploadPanel";
import { StatTile } from "@/components/site/StatTile";
import { Button, Notice, Panel } from "./ui";

interface ApiInfo {
  status: "skipped" | "disabled" | "ok" | "error";
  message?: string;
  sentTexts: string[];
  skipped?: number;
  stats?: { cached: number; embedded: number; fallback: number };
}

function bankLabel(bank: Bank): string {
  return SUPPORTED_BANKS.find((b) => b.id === bank)?.label ?? bank;
}

export function KontoKlarApp({ turnstileSiteKey, cacheDays }: { turnstileSiteKey: string; cacheDays: number }) {
  const [items, setItems] = useState<CategorizedTransaction[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [isSample, setIsSample] = useState(false);
  const [parseInfo, setParseInfo] = useState<{ bank: Bank; skipped: number; warnings: number } | null>(null);
  const [apiInfo, setApiInfo] = useState<ApiInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSent, setShowSent] = useState(false);

  const onParsed = useCallback(async (result: ParseResult, name: string, options: UploadOptions) => {
    setBusy(true);
    setShowSent(false);
    setFileName(name);
    setIsSample(options.sample === true);
    setParseInfo({ bank: result.bank, skipped: result.skipped, warnings: result.warnings.length });
    const ruled = applyRules(result.transactions);
    setItems(ruled);
    const texts = options.useApi ? collectApiTexts(ruled) : [];
    const skipped = options.useApi ? Math.max(0, collectApiCandidates(ruled).length - texts.length) : 0;
    if (!options.useApi) {
      setApiInfo({ status: "skipped", sentTexts: [] });
      setBusy(false);
      return;
    }
    if (texts.length === 0) {
      setApiInfo({ status: "ok", sentTexts: [], stats: { cached: 0, embedded: 0, fallback: 0 } });
      setBusy(false);
      return;
    }
    try {
      const res = await callCategorizeApi(texts, options.turnstileToken ?? undefined);
      if (res.ok && res.response) {
        setItems(mergeApiResults(ruled, res.response.results));
        setApiInfo({ status: "ok", sentTexts: texts, skipped, stats: res.response.stats });
      } else if (res.disabled) {
        setApiInfo({ status: "disabled", message: res.message, sentTexts: texts });
      } else {
        setApiInfo({ status: "error", message: res.message, sentTexts: texts });
      }
    } catch (e) {
      setApiInfo({ status: "error", message: (e as Error).message, sentTexts: texts });
    } finally {
      setBusy(false);
    }
  }, []);

  const onChange = useCallback((id: string, category: Category) => {
    setItems((prev) => (prev ? setManualCategory(prev, id, category) : prev));
  }, []);

  const onApplyToMerchant = useCallback((merchantKey: string, category: Category) => {
    setItems((prev) => (prev ? applyManualToSameMerchant(prev, merchantKey, category) : prev));
  }, []);

  const reset = () => {
    setItems(null);
    setApiInfo(null);
    setParseInfo(null);
    setFileName("");
    setIsSample(false);
    setShowSent(false);
  };

  if (!items) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <UploadPanel turnstileSiteKey={turnstileSiteKey} busy={busy} onParsed={onParsed} />
        <section
          aria-labelledby="privacy-title"
          className="grid gap-6 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12"
        >
          <div>
            <p className="eyebrow">Datenschutz</p>
            <h2 id="privacy-title" className="display mt-2 text-[1.625rem] leading-tight text-ink sm:text-[1.75rem]">
              Was den Browser verlässt
            </h2>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-moss/30 bg-moss-soft/60 px-3 py-1 text-xs font-medium text-moss">
              <span aria-hidden="true" className="h-1.5 w-1.5 rotate-45 bg-moss" />
              API-Schritt standardmäßig aus
            </p>
          </div>
          <div className="min-w-0 lg:border-l lg:border-line lg:pl-10" data-testid="privacy-summary">
            <p className="mb-3 text-base font-medium text-ink">Ohne eingeschalteten API-Schritt verlässt nichts den Browser.</p>{" "}
            <p className="max-w-[68ch] text-[15px] leading-[1.7] text-slate">
              Nur wenn Sie ihn einschalten, gehen Händlernamen, die die Regel-Engine nicht kennt, an den Server, zum Beispiel{" "}
              <code className="rounded-md border border-line bg-ivory px-1.5 py-0.5 font-mono text-[0.85em] whitespace-nowrap text-ink">REWE SAGT DANKE</code>.
              Gesendet werden höchstens bereinigte Händlernamen von Kartenzahlungen und Lastschriften sowie von Überweisungen
              und sonstigen Abbuchungen an Empfänger mit Firmenkennzeichen (etwa GmbH, AG, Versicherung), bei PayPal der
              Händlername aus „Ihr Einkauf bei …“, wenn er ein Firmenkennzeichen trägt. Gutschriften, Überweisungen an
              Empfänger ohne Firmenkennzeichen, PayPal-Einkäufe bei Verkäufern ohne Firmenkennzeichen (etwa Privatpersonen),
              Buchungen ohne lesbaren Empfängernamen und Verwendungszwecke werden nicht gesendet, ebenso keine IBANs, Beträge
              oder Buchungsdaten. Die Erkennung ist regelbasiert; die Liste der gesendeten Texte zeigt nach jedem Upload, was
              den Browser verlassen hat. Nur bei eingeschaltetem API-Schritt speichert der Server einen Cache von Händlername
              zu Kategorie für {cacheDays} Tage und für das Aufruflimit einen Zähler unter einem HMAC-Wert Ihrer IP-Adresse,
              nicht die IP-Adresse selbst; Einzelheiten stehen in der Datenschutzerklärung.
            </p>
          </div>
        </section>
      </div>
    );
  }

  const summary = summarize(items);
  const autoShare = autoAssignedShare(summary);
  const bankHint = parseInfo ? `${bankLabel(parseInfo.bank)}${parseInfo.skipped ? `, ${parseInfo.skipped} übersprungen` : ""}` : undefined;
  const postedTexts = apiInfo !== null && apiInfo.status !== "skipped" && apiInfo.sentTexts.length > 0;
  const apiCount = summary.byCache + summary.byKnn + summary.byLlm;

  return (
    <div className="space-y-6 sm:space-y-8">
      <Panel
        eyebrow="Ergebnis"
        title={isSample ? "Ergebnis für Beispieldaten" : `Ergebnis für ${fileName}`}
        aside={
          <Button variant="secondary" onClick={reset}>
            Neue Datei
          </Button>
        }
        testId="result-panel"
      >
        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
          <StatTile variant="ledger" label="Buchungen" value={String(summary.total)} hint={bankHint} />
          <StatTile variant="ledger" label="Per Regel" value={formatPercent(summary.total ? summary.byRule / summary.total : 0, 0)} hint={`${summary.byRule} Buchungen`} tone="positive" />
          <StatTile
            variant="ledger"
            label="Per API"
            value={String(apiCount)}
            hint={`${summary.byCache} Cache · ${summary.byKnn} Embedding · ${summary.byLlm} Sprachmodell`}
            tone={apiCount > 0 ? "accent" : "muted"}
          />
          <StatTile
            variant="ledger"
            label="Zur Prüfung"
            value={String(summary.needsReview)}
            hint={`${summary.uncategorized} ohne Zuordnung`}
            tone={summary.needsReview > 0 ? "negative" : "muted"}
          />
          <StatTile
            variant="ledger"
            label="Automatisch zugeordnet"
            value={formatPercent(autoShare, 0)}
            hint={summary.manual > 0 ? `${summary.manual} manuell korrigiert` : undefined}
            className="sm:col-span-2 lg:col-span-1"
          />
        </div>

        <div className="mt-5 space-y-2">
          {isSample && <Notice tone="info">Synthetische Beispieldaten, keine echten Kontodaten. Personen und Konten sind erfunden.</Notice>}
          {busy && <Notice tone="info">Unbekannte Händler werden über die API geklärt …</Notice>}
          {apiInfo?.status === "skipped" && <Notice tone="ok">API-Schritt ausgeschaltet. Nur die Regel-Engine hat gearbeitet; nichts hat den Browser verlassen.</Notice>}
          {apiInfo?.status === "disabled" && (
            <Notice tone="info">
              API-Schritt derzeit nicht verfügbar, nur die Regel-Engine hat gearbeitet. Der Server hat die Händlertexte nicht verarbeitet und nichts gespeichert.
            </Notice>
          )}
          {apiInfo?.status === "error" && <Notice tone="error">API-Fehler: {apiErrorText(apiInfo.message)}</Notice>}
          {apiInfo?.status === "ok" && apiInfo.sentTexts.length > 0 && (
            <Notice tone="ok">
              {apiInfo.sentTexts.length} Händlertexte übertragen · {apiInfo.stats?.cached ?? 0} aus dem Cache · {apiInfo.stats?.embedded ?? 0} neu eingebettet · {apiInfo.stats?.fallback ?? 0} per Sprachmodell.
            </Notice>
          )}
          {apiInfo?.status === "ok" && apiInfo.sentTexts.length === 0 && <Notice tone="ok">Alle Buchungen wurden im Browser zugeordnet. Nichts wurde übertragen.</Notice>}
          {postedTexts && (
            <p className="text-sm">
              <button type="button" className="link" aria-expanded={showSent} onClick={() => setShowSent((s) => !s)}>
                {showSent ? "Liste ausblenden" : "Was genau wurde gesendet?"}
              </button>
            </p>
          )}
          {apiInfo?.skipped ? (
            <Notice tone="warn">
              {apiInfo.skipped} weitere unbekannte Händler wurden nicht angefragt (höchstens {MAX_TEXTS_PER_CALL} je Upload). Sie bleiben zur Prüfung markiert; ein kleinerer Zeitraum je Datei hilft.
            </Notice>
          ) : null}
          {showSent && postedTexts && apiInfo && (
            <div className="rounded-xl border border-line bg-ivory/60 p-4 text-xs">
              <p className="mb-2 font-medium text-ink">Übertragene Händlertexte (pseudonymisiert):</p>
              <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {apiInfo.sentTexts.map((t) => (
                  <li key={t} className="truncate font-mono text-slate">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Panel>

      <ReviewTable items={items} onChange={onChange} onApplyToMerchant={onApplyToMerchant} />
      <Dashboard items={items} />
    </div>
  );
}
