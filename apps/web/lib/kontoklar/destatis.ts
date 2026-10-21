import { inflateRawSync } from "node:zlib";
import Papa from "papaparse";
import { COICOP_DIVISIONS } from "./categories";
import type { CpiData, CpiSeriesPoint } from "./inflation";

export const GENESIS_BASE_URL = "https://genesis.destatis.de/genesisWS/rest/2020";
export const CPI_TOTAL_TABLE = "61111-0002";
export const CPI_DIVISIONS_TABLE = "61111-0006";
export const CPI_DIVISIONS_VARIABLE = "CC13A2";
export const CPI_VALUE_VARIABLE = "PREIS1";
export const CPI_YEARS_BACK = 3;
export const DESTATIS_LICENSE = "Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2-0)";
export const CPI_TOTAL_NAME = "Verbraucherpreisindex insgesamt";

const MISSING_VALUES = new Set(["...", ".", "-", "/", "x", ""]);
const ZIP_LOCAL = 0x04034b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_END = 0x06054b50;

export interface TablefileRequest {
  table: string;
  url: string;
  init: { method: "POST"; headers: Record<string, string>; body: string };
}

export function tablefileRequest(token: string, table: string, params: Record<string, string> = {}): TablefileRequest {
  const body = new URLSearchParams({
    name: table,
    area: "all",
    compress: "false",
    transpose: "false",
    format: "ffcsv",
    job: "false",
    language: "de",
    ...params,
  });
  return {
    table,
    url: `${GENESIS_BASE_URL}/data/tablefile`,
    init: {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", username: token, password: "" },
      body: body.toString(),
    },
  };
}

export function cpiRequests(token: string, startYear: number): { total: TablefileRequest; divisions: TablefileRequest } {
  return {
    total: tablefileRequest(token, CPI_TOTAL_TABLE, { startyear: String(startYear) }),
    divisions: tablefileRequest(token, CPI_DIVISIONS_TABLE, { startyear: String(startYear), classifyingvariable1: CPI_DIVISIONS_VARIABLE }),
  };
}

function u16(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

function u32(bytes: Uint8Array, at: number): number {
  return (u16(bytes, at) | (u16(bytes, at + 2) << 16)) >>> 0;
}

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && u32(bytes, 0) === ZIP_LOCAL;
}

export function unzipCsv(bytes: Uint8Array): Uint8Array {
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65_535); i--) {
    if (u32(bytes, i) === ZIP_END) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("GENESIS-Antwort ist kein lesbares ZIP-Archiv");
  const count = u16(bytes, end + 10);
  let offset = u32(bytes, end + 16);
  const entries: { name: string; method: number; size: number; local: number }[] = [];
  for (let i = 0; i < count; i++) {
    if (u32(bytes, offset) !== ZIP_CENTRAL) throw new Error("ZIP-Verzeichnis der GENESIS-Antwort ist beschädigt");
    const nameLength = u16(bytes, offset + 28);
    entries.push({
      method: u16(bytes, offset + 10),
      size: u32(bytes, offset + 20),
      name: new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
      local: u32(bytes, offset + 42),
    });
    offset += 46 + nameLength + u16(bytes, offset + 30) + u16(bytes, offset + 32);
  }
  const entry = entries.find((e) => e.name.toLowerCase().endsWith(".csv")) ?? entries[0];
  if (!entry) throw new Error("ZIP-Archiv der GENESIS-Antwort ist leer");
  if (u32(bytes, entry.local) !== ZIP_LOCAL) throw new Error("ZIP-Eintrag der GENESIS-Antwort ist beschädigt");
  const start = entry.local + 30 + u16(bytes, entry.local + 26) + u16(bytes, entry.local + 28);
  const data = bytes.subarray(start, start + entry.size);
  if (entry.method === 0) return data;
  if (entry.method === 8) return new Uint8Array(inflateRawSync(data));
  throw new Error(`ZIP-Kompression ${entry.method} wird nicht unterstützt`);
}

export function genesisResponseText(bytes: Uint8Array): string {
  const raw = isZip(bytes) ? unzipCsv(bytes) : bytes;
  const text = new TextDecoder("utf-8").decode(raw).replace(/^﻿/, "");
  if (text.trimStart().startsWith("{")) {
    let status: { Code?: number; Content?: string } | undefined;
    try {
      status = (JSON.parse(text) as { Status?: { Code?: number; Content?: string } }).Status;
    } catch {
      status = undefined;
    }
    const hint = status?.Code === 98 ? " Die Tabelle ist für den direkten Abruf zu groß; den Zeitraum (CPI_YEARS_BACK) verkleinern." : "";
    throw new Error(`GENESIS-Antwort ist keine CSV-Datei (Status ${status?.Code ?? "unbekannt"}: ${status?.Content ?? text.slice(0, 200)}).${hint}`);
  }
  return text;
}

export interface FlatCpiRow {
  period: string;
  code: string | null;
  value: number;
  baseYear: number;
}

function germanNumber(raw: string): number {
  const s = raw.trim();
  return Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
}

export function parseFlatCsv(csv: string): FlatCpiRow[] {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^﻿/, ""), { header: true, delimiter: ";", skipEmptyLines: "greedy" });
  const fields = parsed.meta.fields ?? [];
  for (const required of ["time", "value", "value_unit", "value_variable_code"]) {
    if (!fields.includes(required)) throw new Error(`Unerwartetes GENESIS-Format, Spalte ${required} fehlt (Spalten: ${fields.join(", ")})`);
  }
  const variables = fields.map((f) => /^(\d+)_variable_code$/.exec(f)?.[1]).filter((n): n is string => n !== undefined);
  const rows: FlatCpiRow[] = [];
  for (const row of parsed.data) {
    if (row.value_variable_code?.trim() !== CPI_VALUE_VARIABLE) continue;
    const base = /^(\d{4})=100$/.exec(row.value_unit?.trim() ?? "");
    if (!base) continue;
    const raw = row.value?.trim() ?? "";
    if (MISSING_VALUES.has(raw)) continue;
    const value = germanNumber(raw);
    const year = row.time?.trim() ?? "";
    let month: string | null = null;
    let code: string | null = null;
    for (const n of variables) {
      const variable = row[`${n}_variable_code`]?.trim();
      const attribute = row[`${n}_variable_attribute_code`]?.trim() ?? "";
      if (variable === "MONAT") month = /^MONAT(\d{2})$/.exec(attribute)?.[1] ?? null;
      if (variable === CPI_DIVISIONS_VARIABLE) code = attribute;
    }
    if (!/^\d{4}$/.test(year) || !month || !Number.isFinite(value)) continue;
    rows.push({ period: `${year}-${month}`, code, value, baseYear: Number(base[1]) });
  }
  return rows;
}

function toSeries(rows: readonly FlatCpiRow[], label: string): CpiSeriesPoint[] {
  const byPeriod = new Map<string, number>();
  for (const row of rows) {
    const known = byPeriod.get(row.period);
    if (known !== undefined && known !== row.value) throw new Error(`Widersprüchliche Werte für ${label}, ${row.period}`);
    byPeriod.set(row.period, row.value);
  }
  return [...byPeriod.entries()].map(([period, value]) => ({ period, value })).sort((a, b) => a.period.localeCompare(b.period));
}

export function cpiSource(baseYear: number): string {
  return `Statistisches Bundesamt (Destatis), GENESIS-Online, Tabellen ${CPI_TOTAL_TABLE} (Verbraucherpreisindex: Deutschland, Monate) und ${CPI_DIVISIONS_TABLE} (Verbraucherpreisindex: Deutschland, Monate, Klassifikation der Verwendungszwecke des Individualkonsums, COICOP 2-Steller), Verbraucherpreisindex (${baseYear}=100)`;
}

export function buildCpiData(totalCsv: string, divisionsCsv: string, fetchedAt: string): CpiData {
  const totalRows = parseFlatCsv(totalCsv).filter((r) => r.code === null);
  const divisionRows = parseFlatCsv(divisionsCsv).filter((r) => r.code !== null);
  const baseYears = [...new Set([...totalRows, ...divisionRows].map((r) => r.baseYear))];
  if (baseYears.length !== 1) throw new Error(`Uneinheitliche oder fehlende Basisjahre in der GENESIS-Antwort: ${baseYears.join(", ") || "keine"}`);
  const baseYear = baseYears[0]!;
  const divisions = Object.fromEntries(
    Object.entries(COICOP_DIVISIONS).map(([code, name]) => [
      code,
      { name, series: toSeries(divisionRows.filter((r) => r.code === `CC13-${code}`), `Abteilung ${code}`) },
    ]),
  );
  const total = { name: CPI_TOTAL_NAME, series: toSeries(totalRows, "Gesamtindex") };
  const missing = Object.entries(divisions)
    .filter(([, d]) => d.series.length === 0)
    .map(([code]) => code);
  if (missing.length > 0 || total.series.length === 0) {
    throw new Error(`Unvollständige Daten (fehlende Abteilungen: ${missing.join(", ") || "keine"}, Gesamtindex: ${total.series.length} Monate). cpi.json bleibt unverändert.`);
  }
  return { source: cpiSource(baseYear), license: DESTATIS_LICENSE, baseYear, fetchedAt, sample: false, divisions, total };
}

export async function fetchCpiData(token: string, options: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<CpiData> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const requests = cpiRequests(token, now.getFullYear() - CPI_YEARS_BACK);
  const texts: string[] = [];
  for (const request of [requests.total, requests.divisions]) {
    const res = await fetchImpl(request.url, request.init);
    if (!res.ok) throw new Error(`GENESIS antwortet für Tabelle ${request.table} mit HTTP ${res.status}`);
    texts.push(genesisResponseText(new Uint8Array(await res.arrayBuffer())));
  }
  return buildCpiData(texts[0]!, texts[1]!, now.toISOString().slice(0, 10));
}
