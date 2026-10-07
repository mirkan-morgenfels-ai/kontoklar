"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { decodeCsvBytes, detectBank, detectFileKind, parseBankCsv, previewHeaders, SUPPORTED_BANKS, type Bank, type GenericMapping, type ParseResult } from "@portfolio/csv";
import { fetchApiStatus } from "@/lib/kontoklar/categorize";
import type { ApiStatusResponse } from "@/lib/kontoklar/types";
import { cx } from "@/components/site/cx";
import { UploadGlyph } from "@/components/site/motif";
import { Button, Notice, Panel } from "./ui";
import { Turnstile } from "./Turnstile";

export interface UploadOptions {
  useApi: boolean;
  turnstileToken: string | null;
  sample?: boolean;
}

interface Props {
  turnstileSiteKey: string;
  busy: boolean;
  onParsed: (result: ParseResult, fileName: string, options: UploadOptions) => void;
}

const SAMPLE_SHOWS = [
  "Kategorie, Quelle und Konfidenz je Buchung",
  "Ausgaben je Monat und nach Kategorie",
  "Abos und andere regelmäßige Zahlungen",
  "Persönliche Inflationsrate mit Beispielwerten",
] as const;

const EMPTY_MAPPING: GenericMapping = { bookingDate: "", counterparty: "", purpose: "", amount: "" };

export function UploadPanel({ turnstileSiteKey, busy, onParsed }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [bank, setBank] = useState<Bank | "auto">("auto");
  const [detected, setDetected] = useState<Bank | "unknown" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useApi, setUseApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatusResponse | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [mapping, setMapping] = useState<GenericMapping>(EMPTY_MAPPING);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchApiStatus().then((status) => {
      if (cancelled) return;
      setApiStatus(status);
      if (!status.enabled) setUseApi(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const preview = useMemo(() => {
    if (!text) return null;
    try {
      return previewHeaders(text, 3);
    } catch {
      return null;
    }
  }, [text]);

  const effectiveBank: Bank | "unknown" = bank === "auto" ? (detected ?? "unknown") : bank;
  const needsMapping = effectiveBank === "generic" || effectiveBank === "unknown";
  const mappingComplete = mapping.bookingDate && mapping.counterparty && mapping.amount;

  const loadFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    const buffer = await file.arrayBuffer();
    const kind = detectFileKind(buffer);
    if (kind !== "text") {
      setText(null);
      setDetected(null);
      setError(
        kind === "pdf"
          ? "PDF-Kontoauszüge kann KontoKlar nicht lesen. Bitte im Online-Banking den CSV-Export der Umsätze wählen (bei VR-Bank und Volksbanken: Umsätze → Exportieren → CSV; bei Sparkassen: Umsätze → Export → CSV-CAMT)."
          : kind === "zip"
            ? "Das ist eine Excel- oder ZIP-Datei. Bitte die Umsätze als CSV exportieren oder in Excel über „Speichern unter“ als CSV ablegen."
            : kind === "empty"
              ? "Die Datei ist leer."
              : "Das ist keine Textdatei. Bitte den CSV-Export der Bank verwenden.",
      );
      return;
    }
    const decoded = decodeCsvBytes(buffer);
    setText(decoded);
    const d = detectBank(decoded);
    setDetected(d);
    if (d === "unknown") setBank("auto");
  }, []);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void loadFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void loadFile(file);
  };

  const onToken = useCallback((token: string | null) => setTurnstileToken(token), []);

  const loadSample = async () => {
    setError(null);
    try {
      const { SAMPLE_CSV_DEMO, SAMPLE_CSV_DEMO_NAME } = await import("@/lib/kontoklar/sample");
      onParsed(parseBankCsv(SAMPLE_CSV_DEMO, "dkb"), SAMPLE_CSV_DEMO_NAME, { useApi: false, turnstileToken: null, sample: true });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const start = () => {
    if (!text) return;
    setError(null);
    try {
      const result = needsMapping
        ? parseBankCsv(text, "generic", { ...mapping, purpose: mapping.purpose || mapping.counterparty })
        : parseBankCsv(text, effectiveBank as Bank);
      if (result.transactions.length === 0) {
        const columns = preview?.columns.length ? ` Erkannte Spalten: ${preview.columns.join(" · ")}.` : "";
        setError(`Keine Buchungen gefunden (${result.skipped} Zeilen ohne gültiges Datum oder Betrag).${columns} Bitte Bank oder Spaltenzuordnung prüfen.`);
        return;
      }
      onParsed(result, fileName, { useApi, turnstileToken });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const turnstileRequired = useApi && turnstileSiteKey !== "" && apiStatus?.turnstile === true && !turnstileToken;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <Panel eyebrow="Upload" title="CSV-Export hochladen" testId="upload-panel">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          role="button"
          tabIndex={0}
          data-testid="upload-zone"
          data-ready={apiStatus === null ? "false" : "true"}
          className={cx(
            "group flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-5 py-9 text-center transition-colors duration-150 sm:px-10 sm:py-10",
            dragOver ? "border-gold bg-gold-soft" : "border-line-strong/60 bg-ivory/50 hover:border-gold hover:bg-ivory",
          )}
        >
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} data-testid="csv-input" />
          <span className="grid h-14 w-14 place-items-center rounded-full border border-line bg-surface text-ink shadow-card">
            <UploadGlyph className="h-8 w-8" />
          </span>
          <p className="display mt-5 text-[1.375rem] leading-snug text-balance text-ink sm:text-[1.5rem]">CSV hierher ziehen oder klicken</p>
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-slate">
            DKB, ING, comdirect, N26, VR-Bank und Sparkasse werden erkannt. Andere Banken über Spaltenzuordnung. Nur CSV, keine PDF. Die
            Datei bleibt im Browser.
          </p>
          <span aria-hidden="true" className="mt-6 inline-flex items-center rounded-full bg-navy-950 px-5 py-2.5 text-sm font-medium text-ivory transition-colors duration-150 group-hover:bg-navy-800">
            Datei auswählen
          </span>
          {fileName && text && (
            <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-moss/30 bg-moss-soft/60 px-3 py-1 text-xs font-medium text-moss">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rotate-45 bg-moss" />
              <span className="min-w-0 break-all">Geladen: {fileName}</span>
            </p>
          )}
          {fileName && !text && error && (
            <p className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-wine/25 bg-wine-soft/60 px-3 py-1 text-xs font-medium text-wine">
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rotate-45 bg-wine" />
              <span className="min-w-0 break-all">Nicht gelesen: {fileName}</span>
            </p>
          )}
        </div>

        {text && (
          <div className="mt-8 grid gap-6 border-t border-line pt-6 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="eyebrow block text-slate">Bank</span>
              <select value={bank} onChange={(e) => setBank(e.target.value as Bank | "auto")} className="field mt-2">
                <option value="auto">Automatisch{detected ? ` (${detected === "unknown" ? "nicht erkannt" : SUPPORTED_BANKS.find((b) => b.id === detected)?.label})` : ""}</option>
                {SUPPORTED_BANKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm">
              <span className="eyebrow block text-slate">API-Schritt</span>
              <label className="mt-2 flex items-start gap-2.5 py-1.5">
                <input
                  type="checkbox"
                  checked={useApi}
                  disabled={!apiStatus?.enabled}
                  onChange={(e) => setUseApi(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-navy-950"
                />
                <span className={apiStatus?.enabled ? "text-ink" : "text-slate"}>Unbekannte Händler per Embedding-API klären</span>
              </label>
              <p className="mt-1.5 text-xs leading-relaxed text-slate">
                {apiStatus === null ? (
                  "Verfügbarkeit wird geprüft …"
                ) : apiStatus.enabled ? (
                  <>
                    {useApi
                      ? "An: Händlernamen ohne Regeltreffer gehen an den Server und von dort an OpenAI."
                      : "Aus: nur die Regel-Engine, nichts verlässt den Browser. Mit Haken gehen Händlernamen ohne Regeltreffer an den Server und von dort an OpenAI."}{" "}
                    Der Server speichert die Zuordnungen und einen Zähler zu Ihrer pseudonymisierten IP-Adresse bei Upstash; die
                    Bot-Prüfung lädt Cloudflare Turnstile. Einzelheiten:{" "}
                    <Link href="/datenschutz" className="link">
                      Datenschutzerklärung
                    </Link>
                    .
                  </>
                ) : (
                  `Derzeit nicht verfügbar: ${apiStatus.missing?.length ? "Der API-Schritt ist auf dem Server noch nicht vollständig eingerichtet." : (apiStatus.reason ?? "unbekannter Grund")} Die Regel-Engine arbeitet allein; nichts verlässt den Browser.`
                )}
              </p>
            </div>
          </div>
        )}

        {text && needsMapping && preview && (
          <div className="mt-6 rounded-xl border border-line bg-ivory/60 p-4 sm:p-5">
            <p className="text-sm font-medium text-ink">Spalten zuordnen</p>
            <p className="mt-1 text-xs leading-relaxed break-words text-slate">
              Erkannte Kopfzeile (Zeile {preview.headerIndex + 1}, Trennzeichen „{preview.delimiter === "\t" ? "Tab" : preview.delimiter}“): {preview.columns.join(" · ")}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["bookingDate", "Buchungsdatum *"],
                  ["amount", "Betrag *"],
                  ["counterparty", "Empfänger / Auftraggeber *"],
                  ["purpose", "Verwendungszweck"],
                  ["valueDate", "Wertstellung"],
                  ["type", "Umsatzart"],
                ] as [keyof GenericMapping, string][]
              ).map(([key, label]) => (
                <label key={key} className="block text-sm">
                  <span className="block text-xs text-slate">{label}</span>
                  <select
                    value={(mapping[key] as string | undefined) ?? ""}
                    onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                    className="field"
                  >
                    <option value="">–</option>
                    {preview.columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>
        )}

        {text && useApi && turnstileSiteKey && apiStatus?.turnstile && (
          <div className="mt-6">
            <p className="eyebrow mb-2 text-slate">Bot-Prüfung</p>
            <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
          </div>
        )}

        {error && (
          <div className="mt-6">
            <Notice tone="error">{error}</Notice>
          </div>
        )}

        {text && (
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button onClick={start} disabled={busy || (needsMapping && !mappingComplete) || turnstileRequired}>
              {busy ? "Kategorisiere …" : "Kategorisieren"}
            </Button>
            {turnstileRequired && <span className="text-xs text-slate">Bitte zuerst die Bot-Prüfung abschließen.</span>}
          </div>
        )}
      </Panel>

      <div
        className={cx(
          "surface-navy relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border border-navy-700 p-7 sm:p-8",
          text || error ? "lg:self-start" : "",
        )}
        data-testid="sample-card"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 -right-28 -z-10 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(62_106_158/0.30),transparent)]"
        />
        <p className="eyebrow">Ohne eigene Daten</p>
        <h3 className="display mt-3 text-[1.75rem] leading-tight text-ivory">
          Mit den <em className="text-gold-light">Beispieldaten</em> ausprobieren
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-navy-300">Synthetische Beispieldaten, keine echten Kontodaten.</p>
        <ul className="mt-6 space-y-2.5 border-t border-navy-700 pt-6 text-[13px] leading-snug text-ivory/85">
          {SAMPLE_SHOWS.map((item) => (
            <li key={item} className="flex gap-3">
              <span aria-hidden="true" className="mt-[0.4em] h-1.5 w-1.5 shrink-0 rotate-45 bg-gold" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-8">
          <Button variant="gold" onClick={() => void loadSample()} disabled={busy}>
            Mit Beispieldaten ausprobieren
          </Button>
        </div>
      </div>
    </div>
  );
}
