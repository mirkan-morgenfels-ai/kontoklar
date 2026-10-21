import Papa from "papaparse";
import { decodeCsvBytes, detectBank, detectFileKind, parseBankCsv, parseDate, type FileKind } from "@portfolio/csv";

export type DateFormat = "TT.MM.JJJJ" | "TT.MM.JJ" | "JJJJ-MM-TT" | "leer" | "anderes";

export interface DateColumnReport {
  column: string;
  formats: Partial<Record<DateFormat, number>>;
  unreadable: number;
}

export interface CsvCheckReport {
  fileKind: FileKind;
  bytes: number;
  encoding: "UTF-8 mit BOM" | "UTF-8 ohne BOM" | "Windows-1252 (kein gültiges UTF-8)" | "–";
  lineEndings: "CRLF" | "LF" | "CR" | "gemischt" | "–";
  headerLine: number | null;
  linesBeforeHeader: number | null;
  delimiter: ";" | "," | "Tabulator" | null;
  headerColumns: string[];
  dataRows: number;
  dateColumns: DateColumnReport[];
  detectedBank: string;
  parsed: { transactions: number; skipped: number } | null;
  findings: string[];
}

const HEADER_MARKERS = /^"?(Buchungsdatum|Buchungstag)"?[;,\t]/;
const DATE_COLUMN = /^(Buchungsdatum|Buchungstag|Wertstellung|Valutadatum)$/i;
const DKB_NEW_COLUMNS = ["Buchungsdatum", "Wertstellung", "Status", "Zahlungspflichtige*r", "Zahlungsempfänger*in", "Verwendungszweck", "Umsatztyp", "IBAN", "Betrag (€)", "Gläubiger-ID", "Mandatsreferenz", "Kundenreferenz"];
const DELIMITERS: { char: string; name: CsvCheckReport["delimiter"] }[] = [
  { char: ";", name: ";" },
  { char: ",", name: "," },
  { char: "\t", name: "Tabulator" },
];

export function classifyDate(raw: string): DateFormat {
  const s = raw.trim();
  if (s === "") return "leer";
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return "TT.MM.JJJJ";
  if (/^\d{2}\.\d{2}\.\d{2}$/.test(s)) return "TT.MM.JJ";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return "JJJJ-MM-TT";
  return "anderes";
}

function lineEndings(text: string): CsvCheckReport["lineEndings"] {
  const crlf = (text.match(/\r\n/g) ?? []).length;
  const lf = (text.match(/(?<!\r)\n/g) ?? []).length;
  const cr = (text.match(/\r(?!\n)/g) ?? []).length;
  const kinds = [crlf > 0, lf > 0, cr > 0].filter(Boolean).length;
  if (kinds === 0) return "–";
  if (kinds > 1) return "gemischt";
  return crlf > 0 ? "CRLF" : lf > 0 ? "LF" : "CR";
}

function encodingOf(bytes: Uint8Array): CsvCheckReport["encoding"] {
  if (bytes.length === 0) return "–";
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return "UTF-8 mit BOM";
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return "UTF-8 ohne BOM";
  } catch {
    return "Windows-1252 (kein gültiges UTF-8)";
  }
}

export function checkBankCsv(buffer: ArrayBuffer): CsvCheckReport {
  const bytes = new Uint8Array(buffer);
  const fileKind = detectFileKind(buffer);
  const report: CsvCheckReport = {
    fileKind,
    bytes: bytes.length,
    encoding: encodingOf(bytes),
    lineEndings: "–",
    headerLine: null,
    linesBeforeHeader: null,
    delimiter: null,
    headerColumns: [],
    dataRows: 0,
    dateColumns: [],
    detectedBank: "–",
    parsed: null,
    findings: [],
  };
  if (fileKind !== "text") {
    report.findings.push(`Die Datei ist keine Textdatei (erkannt: ${fileKind}). Bitte den CSV-Export verwenden, nicht PDF oder ZIP.`);
    return report;
  }
  const text = decodeCsvBytes(buffer);
  report.lineEndings = lineEndings(text);
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const headerIndex = lines.slice(0, 30).findIndex((line) => HEADER_MARKERS.test(line.trim()));
  report.detectedBank = detectBank(text);
  if (headerIndex < 0) {
    report.findings.push("Keine Kopfzeile mit „Buchungsdatum“ oder „Buchungstag“ in den ersten 30 Zeilen gefunden.");
    return report;
  }
  const headerText = lines[headerIndex]!;
  const scored = DELIMITERS.map((d) => ({ ...d, cells: Papa.parse<string[]>(headerText, { delimiter: d.char }).data[0]?.length ?? 0 })).sort((a, b) => b.cells - a.cells);
  const delimiter = scored[0]!;
  report.headerLine = headerIndex + 1;
  report.linesBeforeHeader = headerIndex;
  report.delimiter = delimiter.name;
  const table = Papa.parse<Record<string, string>>(lines.slice(headerIndex).join("\n"), { header: true, delimiter: delimiter.char, skipEmptyLines: "greedy" });
  report.headerColumns = (table.meta.fields ?? []).map((f) => f.trim());
  report.dataRows = table.data.length;
  report.dateColumns = report.headerColumns
    .filter((column) => DATE_COLUMN.test(column))
    .map((column) => {
      const formats: Partial<Record<DateFormat, number>> = {};
      let unreadable = 0;
      for (const row of table.data) {
        const value = row[column] ?? "";
        const format = classifyDate(value);
        formats[format] = (formats[format] ?? 0) + 1;
        if (format !== "leer" && parseDate(value) === null) unreadable++;
      }
      return { column, formats, unreadable };
    });
  if (report.detectedBank !== "unknown") {
    const result = parseBankCsv(text);
    report.parsed = { transactions: result.transactions.length, skipped: result.skipped };
  }
  if (report.detectedBank !== "dkb") report.findings.push(`KontoKlar erkennt die Datei nicht als DKB-Export (erkannt: ${report.detectedBank}).`);
  if (delimiter.name !== ";") report.findings.push(`Trennzeichen ist ${delimiter.name}, der DKB-Parser erwartet „;“.`);
  const missing = DKB_NEW_COLUMNS.filter((c) => !report.headerColumns.includes(c));
  if (report.headerColumns.includes("Buchungsdatum") && missing.length > 0) report.findings.push(`Kopfzeile weicht vom bekannten DKB-Format ab, es fehlen: ${missing.join(", ")}.`);
  const extra = report.headerColumns.filter((c) => !DKB_NEW_COLUMNS.includes(c));
  if (report.headerColumns.includes("Buchungsdatum") && extra.length > 0) report.findings.push(`Zusätzliche Spalten gegenüber dem bekannten DKB-Format: ${extra.join(", ")}.`);
  for (const column of report.dateColumns) {
    if (column.unreadable > 0) report.findings.push(`Spalte ${column.column}: ${column.unreadable} Werte, die der Parser nicht als Datum liest.`);
    const unexpected = (column.formats.anderes ?? 0) + (column.formats["JJJJ-MM-TT"] ?? 0) - column.unreadable;
    if (unexpected > 0) report.findings.push(`Spalte ${column.column}: ${unexpected} Werte weder als TT.MM.JJ noch als TT.MM.JJJJ (der Parser liest sie, das Format weicht aber vom bekannten DKB-Export ab).`);
  }
  if (report.parsed && report.parsed.skipped > 0) report.findings.push(`${report.parsed.skipped} Zeilen ohne gültiges Datum oder Betrag übersprungen.`);
  if (report.encoding.startsWith("Windows")) report.findings.push("Kodierung ist nicht UTF-8 (bekannte DKB-Exporte sind UTF-8 mit BOM); KontoKlar liest die Datei als Windows-1252.");
  return report;
}

function formatCounts(formats: Partial<Record<DateFormat, number>>): string {
  return Object.entries(formats)
    .map(([format, count]) => `${format}: ${count}`)
    .join(", ");
}

export function formatCsvCheck(report: CsvCheckReport): string[] {
  const out = [
    `Dateityp: ${report.fileKind}, ${report.bytes} Byte`,
    `Kodierung: ${report.encoding}`,
    `Zeilenenden: ${report.lineEndings}`,
    `Kopfzeile: ${report.headerLine === null ? "nicht gefunden" : `Zeile ${report.headerLine} (${report.linesBeforeHeader} Zeilen davor, Inhalt nicht ausgegeben)`}`,
    `Trennzeichen: ${report.delimiter ?? "–"}`,
    `Spalten (${report.headerColumns.length}): ${report.headerColumns.join(" | ") || "–"}`,
    `Datenzeilen: ${report.dataRows}`,
    ...report.dateColumns.map((c) => `Datumsformat ${c.column}: ${formatCounts(c.formats) || "–"}${c.unreadable > 0 ? `, davon nicht lesbar: ${c.unreadable}` : ""}`),
    `Erkannte Bank: ${report.detectedBank}`,
    `Vom Parser gelesen: ${report.parsed ? `${report.parsed.transactions} Buchungen, ${report.parsed.skipped} übersprungen` : "–"}`,
  ];
  out.push(report.findings.length === 0 ? "Befund: keine Abweichung vom erwarteten DKB-Format." : "Befunde:");
  for (const finding of report.findings) out.push(`- ${finding}`);
  return out;
}
