import type { ParseResult, Transaction } from "../types";
import { cleanText, makeTransactionId, parseAmount, parseDate } from "../normalize";
import { findHeaderLine, parseFromHeader, splitLines } from "../lines";

const NEW_HEADER = /"?Buchungsdatum"?;"?Wertstellung"?;"?Status"?;"?Zahlungspflichtige/i;
const OLD_HEADER = /"?Buchungstag"?;"?Wertstellung"?;"?Buchungstext"?;"?Auftraggeber/i;

export function isDkb(lines: string[]): boolean {
  return findHeaderLine(lines, (l) => NEW_HEADER.test(l) || OLD_HEADER.test(l)) >= 0;
}

export function parseDkb(text: string): ParseResult {
  const lines = splitLines(text);
  const headerIndex = findHeaderLine(lines, (l) => NEW_HEADER.test(l) || OLD_HEADER.test(l));
  if (headerIndex < 0) throw new Error("DKB-Kopfzeile nicht gefunden");
  const isNew = NEW_HEADER.test(lines[headerIndex] ?? "");
  const { rows } = parseFromHeader(lines, headerIndex, ";");
  const transactions: Transaction[] = [];
  const warnings: ParseResult["warnings"] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const lineNo = headerIndex + 2 + i;
    const bookingRaw = isNew ? row["Buchungsdatum"] : row["Buchungstag"];
    const bookingDate = parseDate(bookingRaw ?? "");
    const amountRaw = isNew ? (row["Betrag (€)"] ?? row["Betrag"] ?? row["Betrag (EUR)"]) : row["Betrag (EUR)"];
    const amount = parseAmount(amountRaw ?? "", "comma");
    if (!bookingDate || amount === null) {
      skipped++;
      warnings.push({ line: lineNo, message: "Zeile ohne gültiges Datum oder Betrag übersprungen" });
      return;
    }
    const payer = cleanText(row["Zahlungspflichtige*r"] ?? row["Zahlungspflichtige/r"]);
    const payee = cleanText(row["Zahlungsempfänger*in"] ?? row["Zahlungsempfänger/in"]);
    const oldParty = cleanText(row["Auftraggeber / Begünstigter"]);
    const counterparty = isNew ? (amount < 0 ? payee || payer : payer || payee) : oldParty;
    const purpose = cleanText(row["Verwendungszweck"]);
    const type = cleanText(isNew ? row["Umsatztyp"] : row["Buchungstext"]);
    const valueDate = parseDate(row["Wertstellung"] ?? "");
    transactions.push({
      id: makeTransactionId(["dkb", bookingDate, amount, counterparty, purpose, i]),
      bookingDate,
      valueDate,
      counterparty,
      purpose,
      amount,
      currency: "EUR",
      type,
      bank: "dkb",
    });
  });
  return { bank: "dkb", transactions, warnings, skipped };
}
