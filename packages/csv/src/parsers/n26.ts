import type { ParseResult, Transaction } from "../types";
import { cleanText, makeTransactionId, parseAmount, parseDate } from "../normalize";
import { findHeaderLine, parseFromHeader, splitLines } from "../lines";

const NEW_HEADER = /^"?Booking Date"?,"?Value Date"?,"?Partner Name"?/i;
const OLD_HEADER = /^"?Date"?,"?Payee"?,"?Account number"?/i;

export function isN26(lines: string[]): boolean {
  return findHeaderLine(lines, (l) => NEW_HEADER.test(l) || OLD_HEADER.test(l), 3) >= 0;
}

export function parseN26(text: string): ParseResult {
  const lines = splitLines(text);
  const headerIndex = findHeaderLine(lines, (l) => NEW_HEADER.test(l) || OLD_HEADER.test(l), 3);
  if (headerIndex < 0) throw new Error("N26-Kopfzeile nicht gefunden");
  const isNew = NEW_HEADER.test(lines[headerIndex] ?? "");
  const { rows } = parseFromHeader(lines, headerIndex, ",");
  const transactions: Transaction[] = [];
  const warnings: ParseResult["warnings"] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const lineNo = headerIndex + 2 + i;
    const bookingDate = parseDate((isNew ? row["Booking Date"] : row["Date"]) ?? "", "iso");
    const amount = parseAmount(row["Amount (EUR)"] ?? "", "dot");
    if (!bookingDate || amount === null) {
      skipped++;
      warnings.push({ line: lineNo, message: "Zeile ohne gültiges Datum oder Betrag übersprungen" });
      return;
    }
    const counterparty = cleanText(isNew ? row["Partner Name"] : row["Payee"]);
    const purpose = cleanText(row["Payment Reference"] ?? row["Payment reference"]);
    const type = cleanText(isNew ? row["Type"] : row["Transaction type"]);
    transactions.push({
      id: makeTransactionId(["n26", bookingDate, amount, counterparty, purpose, i]),
      bookingDate,
      valueDate: isNew ? parseDate(row["Value Date"] ?? "", "iso") : null,
      counterparty,
      purpose,
      amount,
      currency: "EUR",
      type,
      bank: "n26",
    });
  });
  return { bank: "n26", transactions, warnings, skipped };
}
