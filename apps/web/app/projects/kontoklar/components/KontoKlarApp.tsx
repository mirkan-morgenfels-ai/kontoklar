"use client";

import { useCallback, useState } from "react";
import type { ParseResult } from "@portfolio/csv";
import type { Category } from "@/lib/kontoklar/categories";
import { applyManualToSameMerchant, applyRules, callCategorizeApi, collectApiCandidates, collectApiTexts, mergeApiResults, setManualCategory, summarize } from "@/lib/kontoklar/categorize";
import { MAX_TEXTS_PER_CALL } from "@/lib/kontoklar/types";
import type { CategorizedTransaction } from "@/lib/kontoklar/types";
import { formatPercent } from "@/lib/kontoklar/analytics";
import { Dashboard } from "./Dashboard";
import { ReviewTable } from "./ReviewTable";
import { UploadPanel, type UploadOptions } from "./UploadPanel";
import { Button, Card, Notice, Stat } from "./ui";

interface ApiInfo {
  status: "skipped" | "disabled" | "ok" | "error";
  message?: string;
  sentTexts: string[];
  skipped?: number;
  stats?: { cached: number; embedded: number; fallback: number };
}

export function KontoKlarApp({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const [items, setItems] = useState<CategorizedTransaction[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseInfo, setParseInfo] = useState<{ bank: string; skipped: number; warnings: number } | null>(null);
  const [apiInfo, setApiInfo] = useState<ApiInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSent, setShowSent] = useState(false);

  const onParsed = useCallback(async (result: ParseResult, name: string, options: UploadOptions) => {
    setBusy(true);
    setFileName(name);
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
  };

  if (!items) {
    return (
      <div className="space-y-6">
        <UploadPanel turnstileSiteKey={turnstileSiteKey} busy={busy} onParsed={onParsed} />
        <Card title="Was den Browser verlässt">
          <p className="text-sm text-stone">
            Nur der normalisierte Händlerteil einer Buchung, den die Regel-Engine nicht kennt, zum Beispiel <code className="rounded bg-paper px-1">REWE SAGT DANKE</code>. Keine Namen, IBANs, Verwendungszwecke, Beträge oder Buchungsdaten. Überweisungen an Privatpersonen werden nie gesendet, und ohne eingeschalteten API-Schritt verlässt gar nichts den Browser. Der Server speichert einen Cache von Händlername zu Kategorie für 30 Tage und für das Aufruflimit einen Zähler unter einem HMAC-Wert Ihrer IP-Adresse, nicht die IP-Adresse selbst; Einzelheiten stehen in der Datenschutzerklärung.
          </p>
        </Card>
      </div>
    );
  }

  const summary = summarize(items);
  const autoShare = summary.total === 0 ? 0 : (summary.byRule + summary.byCache + summary.byKnn + summary.byLlm + summary.manual) / summary.total;

  return (
    <div className="space-y-6">
      <Card
        title={`Ergebnis für ${fileName}`}
        aside={
          <Button variant="secondary" onClick={reset}>
            Neue Datei
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Buchungen" value={String(summary.total)} hint={parseInfo ? `${parseInfo.bank.toUpperCase()}${parseInfo.skipped ? `, ${parseInfo.skipped} übersprungen` : ""}` : undefined} />
          <Stat label="Per Regel" value={formatPercent(summary.total ? summary.byRule / summary.total : 0, 0)} hint={`${summary.byRule} Buchungen`} tone="moss" />
          <Stat label="Per API" value={String(summary.byCache + summary.byKnn + summary.byLlm)} hint={`${summary.byCache} Cache · ${summary.byKnn} Embedding · ${summary.byLlm} Sprachmodell`} tone="gold" />
          <Stat label="Zur Prüfung" value={String(summary.needsReview)} hint={`${summary.uncategorized} ohne Zuordnung`} tone="wine" />
          <Stat label="Automatisch zugeordnet" value={formatPercent(autoShare, 0)} />
        </div>

        <div className="mt-4 space-y-2">
          {busy && <Notice tone="info">Unbekannte Händler werden über die API geklärt …</Notice>}
          {apiInfo?.status === "skipped" && <Notice tone="info">API-Schritt ausgeschaltet. Nur die Regel-Engine hat gearbeitet; nichts hat den Browser verlassen.</Notice>}
          {apiInfo?.status === "disabled" && <Notice tone="info">API-Schritt derzeit nicht verfügbar, nur die Regel-Engine hat gearbeitet. Der Server hat die Händlertexte nicht verarbeitet und nichts gespeichert.</Notice>}
          {apiInfo?.status === "error" && <Notice tone="error">API-Fehler: {apiInfo.message}. Die Regel-Engine bleibt aktiv.</Notice>}
          {apiInfo?.status === "ok" && apiInfo.sentTexts.length > 0 && (
            <Notice tone="ok">
              {apiInfo.sentTexts.length} Händlertexte übertragen · {apiInfo.stats?.cached ?? 0} aus dem Cache · {apiInfo.stats?.embedded ?? 0} neu eingebettet · {apiInfo.stats?.fallback ?? 0} per Sprachmodell.{" "}
              <button type="button" className="underline decoration-dotted" onClick={() => setShowSent((s) => !s)}>
                {showSent ? "Liste ausblenden" : "Was genau wurde gesendet?"}
              </button>
            </Notice>
          )}
          {apiInfo?.status === "ok" && apiInfo.sentTexts.length === 0 && <Notice tone="ok">Alle Buchungen wurden im Browser zugeordnet. Nichts wurde übertragen.</Notice>}
          {apiInfo?.skipped ? (
            <Notice tone="warn">
              {apiInfo.skipped} weitere unbekannte Händler wurden nicht angefragt (höchstens {MAX_TEXTS_PER_CALL} je Upload). Sie bleiben zur Prüfung markiert; ein kleinerer Zeitraum je Datei hilft.
            </Notice>
          ) : null}
          {showSent && apiInfo && apiInfo.sentTexts.length > 0 && (
            <div className="rounded-md border border-line bg-paper p-3 text-xs">
              <p className="mb-1 font-medium">Übertragene Händlertexte (pseudonymisiert):</p>
              <ul className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-3">
                {apiInfo.sentTexts.map((t) => (
                  <li key={t} className="truncate font-mono">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>

      <ReviewTable items={items} onChange={onChange} onApplyToMerchant={onApplyToMerchant} />
      <Dashboard items={items} />
    </div>
  );
}
