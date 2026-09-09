import type { ParseResult, Transaction } from "../types";
import { cleanText, makeTransactionId, parseAmount, parseDate } from "../normalize";
import { findHeaderLine, parseFromHeader, splitLines } from "../lines";

const HEADER = /^"?Auftragskonto"?;"?Buchungstag"?;"?Valutadatum"?;"?Buchungstext"?;"?Verwendungszweck"?;/i;

export function isSparkasse(lines: string[]): boolean {
  return findHeaderLine(lines, (l) => HEADER.test(l)) >= 0;
}

export function parseSparkasse(text: string): ParseResult {
  const lines = splitLines(text);
  const headerIndex = findHeaderLine(lines, (l) => HEADER.test(l));
  if (headerIndex < 0) throw new Error("Sparkassen-Kopfzeile nicht gefunden");
  const { rows } = parseFromHeader(lines, headerIndex, ";");
  const transactions: Transaction[] = [];
  const warnings: ParseResult["warnings"] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const lineNo = headerIndex + 2 + i;
    const bookingDate = parseDate(row["Buchungstag"] ?? "");
    const amount = parseAmount(row["Betrag"] ?? "", "comma");
    if (!bookingDate || amount === null) {
      skipped++;
      if (cleanText(row["Buchungstag"]) !== "") warnings.push({ line: lineNo, message: "Zeile ohne gültiges Datum oder Betrag übersprungen" });
      return;
    }
    const counterparty = cleanText(row["Beguenstigter/Zahlungspflichtiger"] ?? row["Begünstigter/Zahlungspflichtiger"]);
    const purpose = cleanText(row["Verwendungszweck"]);
    const type = cleanText(row["Buchungstext"]);
    const currency = cleanText(row["Waehrung"] || row["Währung"] || "EUR") || "EUR";
    transactions.push({
      id: makeTransactionId(["sparkasse", bookingDate, amount, counterparty, purpose, i]),
      bookingDate,
      valueDate: parseDate(row["Valutadatum"] ?? ""),
      counterparty,
      purpose,
      amount,
      currency,
      type,
      bank: "sparkasse",
    });
  });
  return { bank: "sparkasse", transactions, warnings, skipped };
}
