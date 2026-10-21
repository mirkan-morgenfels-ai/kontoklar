import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { checkBankCsv, classifyDate, formatCsvCheck } from "../csv-check";

const FIXTURES = path.resolve(__dirname, "..", "..", "..", "..", "..", "packages", "csv", "fixtures");
const DKB = readFileSync(path.join(FIXTURES, "dkb.csv"));

function buffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function utf8(text: string, bom = true): ArrayBuffer {
  return buffer(new TextEncoder().encode(`${bom ? "﻿" : ""}${text}`));
}

const HEADER = '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"';
const META = '"Girokonto";"DE02120300000000202051"\n"Zeitraum:";"01.09.2026 - 30.09.2026"\n"Kontostand vom 30.09.2026:";"1.234,56 €"\n""\n';
const ROW = (date: string) => `"${date}";"${date}";"Gebucht";"Erika Beispiel";"Baeckerei Korn GmbH";"Einkauf";"Kartenzahlung";"DE89370400440532013000";"-4,20";"";"";""`;

describe("classifyDate", () => {
  test("names the date formats the DKB parser reads and everything else", () => {
    expect(classifyDate("02.01.2026")).toBe("TT.MM.JJJJ");
    expect(classifyDate("02.01.26")).toBe("TT.MM.JJ");
    expect(classifyDate("2026-01-02")).toBe("JJJJ-MM-TT");
    expect(classifyDate(" ")).toBe("leer");
    expect(classifyDate("2.1.2026")).toBe("anderes");
  });
});

describe("checkBankCsv", () => {
  test("synthetic DKB fixture: header position, delimiter, columns, date formats per column and the deliberately broken amount", () => {
    const report = checkBankCsv(buffer(DKB));
    expect(report.encoding).toBe("UTF-8 mit BOM");
    expect(report.headerLine).toBe(4);
    expect(report.linesBeforeHeader).toBe(3);
    expect(report.delimiter).toBe(";");
    expect(report.headerColumns).toHaveLength(12);
    expect(report.detectedBank).toBe("dkb");
    expect(report.dateColumns.map((c) => c.column)).toEqual(["Buchungsdatum", "Wertstellung"]);
    const booking = report.dateColumns[0]!.formats;
    expect((booking["TT.MM.JJJJ"] ?? 0) + (booking["TT.MM.JJ"] ?? 0)).toBe(report.dataRows);
    expect(booking["TT.MM.JJ"]).toBeGreaterThan(0);
    expect(report.dateColumns.every((c) => c.unreadable === 0)).toBe(true);
    expect(report.parsed).toEqual({ transactions: report.dataRows - 1, skipped: 1 });
    expect(report.findings).toEqual(["1 Zeilen ohne gültiges Datum oder Betrag übersprungen."]);
  });

  test("a new DKB export with two-digit years and metadata lines passes without findings", () => {
    const report = checkBankCsv(utf8(`${META}${HEADER}\n${ROW("01.09.26")}\n${ROW("02.09.26")}\n`));
    expect(report.headerLine).toBe(5);
    expect(report.dateColumns[0]).toEqual({ column: "Buchungsdatum", formats: { "TT.MM.JJ": 2 }, unreadable: 0 });
    expect(report.parsed).toEqual({ transactions: 2, skipped: 0 });
    expect(report.findings).toEqual([]);
  });

  test("a comma-separated export is reported, because the DKB parser expects semicolons", () => {
    const comma = `${META}${HEADER}\n${ROW("01.09.26")}\n`.replace(/";"/g, '","');
    const report = checkBankCsv(utf8(comma));
    expect(report.delimiter).toBe(",");
    expect(report.headerColumns).toHaveLength(12);
    expect(report.findings.join(" ")).toContain("Trennzeichen ist ,");
    expect(report.findings.join(" ")).toContain("nicht als DKB-Export");
  });

  test("other date formats, changed columns, Windows-1252 and non-text files are reported", () => {
    const changed = HEADER.replace(';"Kundenreferenz"', ';"Kategorie"');
    const cp1252 = (text: string) => Array.from(text, (c) => (c === "€" ? 0x80 : c.charCodeAt(0)));
    const bytes = new Uint8Array(cp1252(`${changed}\n${ROW("2026/09/01")}\n${ROW("2026-09-02")}\n`));
    const report = checkBankCsv(buffer(bytes));
    const text = report.findings.join(" ");
    expect(report.encoding).toBe("Windows-1252 (kein gültiges UTF-8)");
    expect(report.detectedBank).toBe("dkb");
    expect(text).toContain("es fehlen: Kundenreferenz.");
    expect(text).toContain("Zusätzliche Spalten gegenüber dem bekannten DKB-Format: Kategorie.");
    expect(text).toContain("Spalte Buchungsdatum: 1 Werte, die der Parser nicht als Datum liest.");
    expect(text).toContain("Spalte Buchungsdatum: 1 Werte weder als TT.MM.JJ noch als TT.MM.JJJJ");
    expect(text).toContain("1 Zeilen ohne gültiges Datum oder Betrag übersprungen");
    expect(report.parsed).toEqual({ transactions: 1, skipped: 1 });
    expect(checkBankCsv(buffer(new TextEncoder().encode("%PDF-1.7"))).findings[0]).toContain("keine Textdatei (erkannt: pdf)");
    expect(checkBankCsv(utf8("Datum;Betrag\n01.09.2026;-1,00\n")).findings[0]).toContain("Keine Kopfzeile");
  });

  test("never prints contents: no IBAN, name, purpose, amount or metadata in the report", () => {
    const report = checkBankCsv(utf8(`${META}${HEADER}\n${ROW("01.09.26")}\n`));
    const printed = [JSON.stringify(report), ...formatCsvCheck(report)].join("\n");
    for (const secret of ["DE02120300000000202051", "DE89370400440532013000", "Erika Beispiel", "Baeckerei Korn", "Einkauf", "4,20", "1.234,56", "Zeitraum", "01.09.26"]) {
      expect(printed).not.toContain(secret);
    }
    expect(formatCsvCheck(report)).toContain("Befund: keine Abweichung vom erwarteten DKB-Format.");
  });
});
