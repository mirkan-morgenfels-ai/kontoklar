import type { ParseResult, Transaction } from "../types";
import { cleanText, makeTransactionId, parseAmount, parseDate } from "../normalize";
import { findHeaderLine, parseFromHeader, splitLines } from "../lines";

const NEW_HEADER = /Buchungstag;Valutadatum;Name Zahlungsbeteiligter;.*;Buchungstext;Verwendungszweck;Betrag;Waehrung/i;
const OLD_HEADER = /^"?Buchungstag"?;"?Valuta"?;"?Auftraggeber\/Zahlungsempf/i;

export function isVrBank(lines: string[]): boolean {
  return findHeaderLine(lines, (l) => NEW_HEADER.test(l) || OLD_HEADER.test(l)) >= 0;
}

function splitOldPurpose(raw: string): { type: string; purpose: string } {
  const parts = raw
    .split(/\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
  if (parts.length === 0) return { type: "", purpose: "" };
  const first = parts[0] ?? "";
  const looksLikeType = parts.length > 1 && first.length <= 40 && !/\d{3,}/.test(first);
  if (looksLikeType) return { type: first, purpose: cleanText(parts.slice(1).join(" ")) };
  return { type: "", purpose: cleanText(parts.join(" ")) };
}

export function parseVrBank(text: string): ParseResult {
  const lines = splitLines(text);
  const headerIndex = findHeaderLine(lines, (l) => NEW_HEADER.test(l) || OLD_HEADER.test(l));
  if (headerIndex < 0) throw new Error("VR-Bank-Kopfzeile nicht gefunden");
  const isNew = NEW_HEADER.test(lines[headerIndex] ?? "");
  const { rows } = parseFromHeader(lines, headerIndex, ";");
  const transactions: Transaction[] = [];
  const warnings: ParseResult["warnings"] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const lineNo = headerIndex + 2 + i;
    const bookingDate = parseDate(row["Buchungstag"] ?? "");
    let amount: number | null;
    let counterparty: string;
    let purpose: string;
    let type: string;
    let currency: string;
    let valueDate: string | null;
    if (isNew) {
      amount = parseAmount(row["Betrag"] ?? "", "comma");
      counterparty = cleanText(row["Name Zahlungsbeteiligter"]);
      purpose = cleanText(row["Verwendungszweck"]);
      type = cleanText(row["Buchungstext"]);
      currency = cleanText(row["Waehrung"] || row["Währung"] || "EUR") || "EUR";
      valueDate = parseDate(row["Valutadatum"] ?? "");
    } else {
      const raw = parseAmount(row["Umsatz"] ?? "", "comma");
      const marker = cleanText(row["Soll/Haben"] ?? row[" "] ?? row[""] ?? "").toUpperCase();
      amount = raw === null ? null : marker === "S" ? -Math.abs(raw) : marker === "H" ? Math.abs(raw) : raw;
      counterparty = cleanText(row["Empfänger/Zahlungspflichtiger"] ?? row["Empfaenger/Zahlungspflichtiger"]);
      const split = splitOldPurpose(row["Vorgang/Verwendungszweck"] ?? "");
      purpose = split.purpose;
      type = split.type;
      currency = cleanText(row["Währung"] || row["Waehrung"] || "EUR") || "EUR";
      valueDate = parseDate(row["Valuta"] ?? "");
    }
    if (!bookingDate || amount === null) {
      skipped++;
      if (cleanText(row["Buchungstag"]) !== "") warnings.push({ line: lineNo, message: "Zeile ohne gültiges Datum oder Betrag übersprungen" });
      return;
    }
    transactions.push({
      id: makeTransactionId(["vrbank", bookingDate, amount, counterparty, purpose, i]),
      bookingDate,
      valueDate,
      counterparty,
      purpose,
      amount,
      currency,
      type,
      bank: "vrbank",
    });
  });
  return { bank: "vrbank", transactions, warnings, skipped };
}
