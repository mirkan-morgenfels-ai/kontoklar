import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COICOP_DIVISIONS } from "../lib/kontoklar/categories";
import type { CpiData, CpiSeriesPoint } from "../lib/kontoklar/inflation";

const root = path.resolve(__dirname, "..", "..", "..");
const output = path.join(root, "data", "k2", "cpi.json");
const GENESIS = "https://www-genesis.destatis.de/genesisWS/rest/2020/data/tablefile";
const TABLE = "61111-0002";
const MONTHS: Record<string, string> = {
  Januar: "01",
  Februar: "02",
  März: "03",
  April: "04",
  Mai: "05",
  Juni: "06",
  Juli: "07",
  August: "08",
  September: "09",
  Oktober: "10",
  November: "11",
  Dezember: "12",
};

async function fetchTable(token: string, startYear: number): Promise<string> {
  const body = new URLSearchParams({
    name: TABLE,
    area: "all",
    compress: "false",
    transpose: "false",
    startyear: String(startYear),
    format: "ffcsv",
    language: "de",
  });
  const res = await fetch(GENESIS, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", username: token, password: "" },
    body,
  });
  if (!res.ok) throw new Error(`GENESIS ${res.status}: ${await res.text()}`);
  const text = await res.text();
  if (text.trim().startsWith("{")) {
    const json = JSON.parse(text) as { Status?: { Content?: string } };
    throw new Error(`GENESIS-Antwort ist kein CSV: ${json.Status?.Content ?? text.slice(0, 200)}`);
  }
  return text;
}

function parseFlatCsv(csv: string): { divisions: Record<string, CpiSeriesPoint[]>; total: CpiSeriesPoint[] } {
  const lines = csv.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  const header = lines[0]!.split(";");
  const idx = (name: string) => header.findIndex((h) => h.trim() === name);
  const iYear = idx("Zeit");
  const iMonth = header.findIndex((h) => /^1_Auspraegung_Code$/.test(h.trim()));
  const iCode = header.findIndex((h) => /^2_Auspraegung_Code$/.test(h.trim()));
  const iLabel = header.findIndex((h) => /^2_Auspraegung_Label$/.test(h.trim()));
  const iValue = header.findIndex((h) => /^PREIS1__Verbraucherpreisindex__2020=100$/.test(h.trim()));
  if ([iYear, iMonth, iCode, iValue].some((i) => i < 0)) throw new Error(`Unerwartete Spalten: ${header.join(" | ")}`);
  const divisions: Record<string, CpiSeriesPoint[]> = {};
  const total: CpiSeriesPoint[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(";");
    const year = cols[iYear]?.trim();
    const monthRaw = cols[iMonth]?.trim() ?? "";
    const month = MONTHS[monthRaw] ?? (/^MONAT(\d{2})$/.exec(monthRaw)?.[1] ?? "");
    const code = cols[iCode]?.trim() ?? "";
    const label = cols[iLabel]?.trim() ?? "";
    const value = Number((cols[iValue] ?? "").replace(",", "."));
    if (!year || !month || !Number.isFinite(value)) continue;
    const point = { period: `${year}-${month}`, value };
    if (code === "CC13-0" || /insgesamt/i.test(label)) {
      total.push(point);
      continue;
    }
    const m = /^CC13-(\d{2})$/.exec(code);
    if (!m) continue;
    const division = m[1]!;
    if (!COICOP_DIVISIONS[division]) continue;
    (divisions[division] ??= []).push(point);
  }
  return { divisions, total };
}

async function main() {
  const token = process.env.DESTATIS_TOKEN;
  if (!token) throw new Error("DESTATIS_TOKEN fehlt (GENESIS-Online API-Token)");
  const startYear = new Date().getFullYear() - 3;
  const csv = await fetchTable(token, startYear);
  const parsed = parseFlatCsv(csv);
  const previous = JSON.parse(readFileSync(output, "utf-8")) as Partial<CpiData>;
  const data: CpiData = {
    source: "Statistisches Bundesamt (Destatis), GENESIS-Online, Tabelle 61111-0002, Verbraucherpreisindex (2020=100)",
    license: "Datenlizenz Deutschland – Namensnennung – Version 2.0 (dl-de/by-2.0)",
    baseYear: 2020,
    fetchedAt: new Date().toISOString().slice(0, 10),
    sample: false,
    divisions: Object.fromEntries(
      Object.entries(COICOP_DIVISIONS).map(([code, name]) => [code, { name, series: (parsed.divisions[code] ?? []).sort((a, b) => a.period.localeCompare(b.period)) }]),
    ),
    total: { name: "Verbraucherpreisindex insgesamt", series: parsed.total.sort((a, b) => a.period.localeCompare(b.period)) },
  };
  const missing = Object.entries(data.divisions).filter(([, d]) => d.series.length === 0).map(([c]) => c);
  if (missing.length > 0 || data.total.series.length === 0) {
    throw new Error(`Unvollständige Daten (fehlende Abteilungen: ${missing.join(", ") || "keine"}, Gesamtindex: ${data.total.series.length} Punkte). Vorherige Datei bleibt erhalten (${previous.fetchedAt ?? "unbekannt"}).`);
  }
  writeFileSync(output, JSON.stringify(data, null, 1) + "\n");
  console.log(`cpi.json aktualisiert: ${data.total.series.length} Monate Gesamtindex, letzter Monat ${data.total.series.at(-1)?.period}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
