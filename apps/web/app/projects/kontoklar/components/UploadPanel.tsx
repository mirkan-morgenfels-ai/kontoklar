"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { decodeCsvBytes, detectBank, detectFileKind, parseBankCsv, previewHeaders, SUPPORTED_BANKS, type Bank, type GenericMapping, type ParseResult } from "@portfolio/csv";
import { fetchApiStatus } from "@/lib/kontoklar/categorize";
import type { ApiStatusResponse } from "@/lib/kontoklar/types";
import { Button, Card, Notice } from "./ui";
import { Turnstile } from "./Turnstile";

export interface UploadOptions {
  useApi: boolean;
  turnstileToken: string | null;
}

interface Props {
  turnstileSiteKey: string;
  busy: boolean;
  onParsed: (result: ParseResult, fileName: string, options: UploadOptions) => void;
}

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
    <Card title="1. CSV-Export hochladen">
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
        aria-label="CSV-Datei auswählen"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
          dragOver ? "border-gold bg-gold-soft" : "border-line bg-paper hover:border-gold"
        }`}
      >
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} data-testid="csv-input" />
        <p className="text-sm font-medium">CSV hierher ziehen oder klicken</p>
        <p className="mt-1 text-xs text-stone">DKB, ING, comdirect, N26, VR-Bank und Sparkasse werden erkannt. Andere Banken über Spaltenzuordnung. Nur CSV, keine PDF. Die Datei bleibt im Browser.</p>
        {fileName && <p className="mt-3 text-xs text-moss">Geladen: {fileName}</p>}
      </div>

      {text && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-stone">Bank</span>
            <select value={bank} onChange={(e) => setBank(e.target.value as Bank | "auto")} className="w-full rounded-md border border-line bg-white px-2 py-1.5">
              <option value="auto">Automatisch{detected ? ` (${detected === "unknown" ? "nicht erkannt" : SUPPORTED_BANKS.find((b) => b.id === detected)?.label})` : ""}</option>
              {SUPPORTED_BANKS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-xs uppercase tracking-wide text-stone">API-Schritt</span>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={useApi} disabled={!apiStatus?.enabled} onChange={(e) => setUseApi(e.target.checked)} className="accent-moss" />
              <span className={apiStatus?.enabled ? "" : "text-stone"}>Unbekannte Händler per Embedding-API klären</span>
            </label>
            <p className="mt-1 text-xs text-stone">
              {apiStatus === null ? (
                "Verfügbarkeit wird geprüft …"
              ) : apiStatus.enabled ? (
                <>
                  {useApi
                    ? "An: Händlernamen ohne Regeltreffer gehen an den Server und von dort an OpenAI."
                    : "Aus: nur die Regel-Engine, nichts verlässt den Browser. Mit Haken gehen Händlernamen ohne Regeltreffer an den Server und von dort an OpenAI."}{" "}
                  Der Server speichert die Zuordnungen und einen Zähler zu Ihrer pseudonymisierten IP-Adresse bei Upstash; die
                  Bot-Prüfung lädt Cloudflare Turnstile. Einzelheiten:{" "}
                  <Link href="/datenschutz" className="underline decoration-gold underline-offset-2 hover:text-ink">
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
        <div className="mt-5 rounded-lg border border-line bg-paper p-4">
          <p className="text-sm font-medium">Spalten zuordnen</p>
          <p className="mt-1 text-xs text-stone">
            Erkannte Kopfzeile (Zeile {preview.headerIndex + 1}, Trennzeichen „{preview.delimiter === "\t" ? "Tab" : preview.delimiter}“): {preview.columns.join(" · ")}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
              <label key={key} className="text-sm">
                <span className="mb-1 block text-xs text-stone">{label}</span>
                <select
                  value={(mapping[key] as string | undefined) ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [key]: e.target.value })}
                  className="w-full rounded-md border border-line bg-white px-2 py-1.5"
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
        <div className="mt-5">
          <p className="mb-1 text-xs uppercase tracking-wide text-stone">Bot-Prüfung</p>
          <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Notice tone="error">{error}</Notice>
        </div>
      )}

      {text && (
        <div className="mt-5 flex items-center gap-3">
          <Button onClick={start} disabled={busy || (needsMapping && !mappingComplete) || turnstileRequired}>
            {busy ? "Kategorisiere …" : "Kategorisieren"}
          </Button>
          {turnstileRequired && <span className="text-xs text-stone">Bitte zuerst die Bot-Prüfung abschließen.</span>}
        </div>
      )}
    </Card>
  );
}
