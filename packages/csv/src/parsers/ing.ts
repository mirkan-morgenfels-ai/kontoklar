import type { ParseResult, Transaction } from "../types";
import { cleanText, makeTransactionId, parseAmount, parseDate } from "../normalize";
import { findHeaderLine, parseFromHeader, splitLines } from "../lines";

const HEADER = /^"?Buchung"?;"?Valuta"?;"?Auftraggeber\/Empf/i;

export function isIng(lines: string[]): boolean {
  return findHeaderLine(lines, (l) => HEADER.test(l)) >= 0 || (lines[0] ?? "").startsWith("Umsatzanzeige");
}

export function parseIng(text: string): ParseResult {
  const lines = splitLines(text);
  const headerIndex = findHeaderLine(lines, (l) => HEADER.test(l));
  if (headerIndex < 0) throw new Error("ING-Kopfzeile nicht gefunden");
  const { rows } = parseFromHeader(lines, headerIndex, ";");
  const transactions: Transaction[] = [];
  const warnings: ParseResult["warnings"] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const lineNo = headerIndex + 2 + i;
    const bookingDate = parseDate(row["Buchung"] ?? "");
    const amount = parseAmount(row["Betrag"] ?? "", "comma");
    if (!bookingDate || amount === null) {
      skipped++;
      warnings.push({ line: lineNo, message: "Zeile ohne gültiges Datum oder Betrag übersprungen" });
      return;
    }
    const counterparty = cleanText(row["Auftraggeber/Empfänger"]);
    const purpose = cleanText(row["Verwendungszweck"]);
    const type = cleanText(row["Buchungstext"]);
    const currency = cleanText(row["Währung"] || "EUR") || "EUR";
    transactions.push({
      id: makeTransactionId(["ing", bookingDate, amount, counterparty, purpose, i]),
      bookingDate,
      valueDate: parseDate(row["Valuta"] ?? ""),
      counterparty,
      purpose,
      amount,
      currency,
      type,
      bank: "ing",
    });
  });
  return { bank: "ing", transactions, warnings, skipped };
}
