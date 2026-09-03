import type { GenericMapping, ParseResult, Transaction } from "../types";
import { cleanText, makeTransactionId, parseAmount, parseDate } from "../normalize";
import { detectDelimiter, findHeaderLine, headerCells, parseFromHeader, splitLines } from "../lines";

export interface HeaderPreview {
  headerIndex: number;
  delimiter: string;
  columns: string[];
  sampleRows: Record<string, string>[];
}

export function previewHeaders(text: string, sampleSize = 3): HeaderPreview {
  const lines = splitLines(text);
  const firstNonEmpty = lines.find((l) => l.trim() !== "") ?? "";
  const delimiterGuess = detectDelimiter(firstNonEmpty);
  const headerIndex = Math.max(
    0,
    findHeaderLine(lines, (l) => l.split(delimiterGuess).length >= 3 && /[A-Za-zÄÖÜäöü]/.test(l)),
  );
  const delimiter = detectDelimiter(lines[headerIndex] ?? "");
  const columns = headerCells(lines[headerIndex] ?? "", delimiter);
  const { rows } = parseFromHeader(lines, headerIndex, delimiter);
  return { headerIndex, delimiter, columns, sampleRows: rows.slice(0, sampleSize) };
}

export function parseGeneric(text: string, mapping: GenericMapping): ParseResult {
  const preview = previewHeaders(text, 0);
  const delimiter = mapping.delimiter ?? preview.delimiter;
  const lines = splitLines(text);
  const { rows } = parseFromHeader(lines, preview.headerIndex, delimiter);
  const transactions: Transaction[] = [];
  const warnings: ParseResult["warnings"] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const lineNo = preview.headerIndex + 2 + i;
    const bookingDate = parseDate(row[mapping.bookingDate] ?? "", mapping.dateFormat ?? "auto");
    const amount = parseAmount(row[mapping.amount] ?? "", "auto");
    if (!bookingDate || amount === null) {
      skipped++;
      warnings.push({ line: lineNo, message: "Zeile ohne gültiges Datum oder Betrag übersprungen" });
      return;
    }
    const counterparty = cleanText(row[mapping.counterparty]);
    const purpose = cleanText(row[mapping.purpose]);
    transactions.push({
      id: makeTransactionId(["generic", bookingDate, amount, counterparty, purpose, i]),
      bookingDate,
      valueDate: mapping.valueDate ? parseDate(row[mapping.valueDate] ?? "", mapping.dateFormat ?? "auto") : null,
      counterparty,
      purpose,
      amount,
      currency: "EUR",
      type: mapping.type ? cleanText(row[mapping.type]) : "",
      bank: "generic",
    });
  });
  return { bank: "generic", transactions, warnings, skipped };
}
