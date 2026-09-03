import type { ParseResult, Transaction } from "../types";
import { cleanText, makeTransactionId, parseAmount, parseDate } from "../normalize";
import { findHeaderLine, parseFromHeader, splitLines } from "../lines";

const HEADER = /^"?Buchungstag"?;"?Wertstellung \(Valuta\)"?;"?Vorgang"?;"?Buchungstext"?;"?Umsatz in EUR"?/i;

export function isComdirect(lines: string[]): boolean {
  return findHeaderLine(lines, (l) => HEADER.test(l)) >= 0;
}

export interface SplitBuchungstext {
  counterparty: string;
  purpose: string;
}

const LABEL_PATTERN = /(?:(Auftraggeber|Empfänger|Kto\/IBAN|BLZ\/BIC|Buchungstext|Kartennr\.|Karte):\s*|(Ref\.)\s+)/g;

export function splitBuchungstext(raw: string): SplitBuchungstext {
  const text = cleanText(raw);
  const matches = [...text.matchAll(LABEL_PATTERN)];
  if (matches.length === 0) {
    return { counterparty: "", purpose: text };
  }
  const fields: Record<string, string> = {};
  matches.forEach((m, idx) => {
    const key = m[1] ?? m[2] ?? "";
    const start = (m.index ?? 0) + m[0].length;
    const next = matches[idx + 1];
    const end = next && next.index !== undefined ? next.index : text.length;
    fields[key] = cleanText(text.slice(start, end));
  });
  const lead = cleanText(text.slice(0, matches[0]?.index ?? 0));
  const counterparty = fields["Auftraggeber"] ?? fields["Empfänger"] ?? "";
  const purposeParts = [fields["Buchungstext"] ?? "", fields["Ref."] ?? ""].filter((p) => p !== "");
  const purpose = purposeParts.length > 0 ? purposeParts.join(" ") : lead;
  return { counterparty: counterparty || lead, purpose };
}

export function parseComdirect(text: string): ParseResult {
  const lines = splitLines(text);
  const headerIndex = findHeaderLine(lines, (l) => HEADER.test(l));
  if (headerIndex < 0) throw new Error("comdirect-Kopfzeile nicht gefunden");
  const { rows } = parseFromHeader(lines, headerIndex, ";");
  const transactions: Transaction[] = [];
  const warnings: ParseResult["warnings"] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    const lineNo = headerIndex + 2 + i;
    const bookingRaw = row["Buchungstag"] ?? "";
    const bookingDate = parseDate(bookingRaw);
    const amount = parseAmount(row["Umsatz in EUR"] ?? "", "comma");
    if (!bookingDate || amount === null) {
      skipped++;
      if (cleanText(bookingRaw) !== "" && !/^(Alter Saldo|Neuer Saldo|offen)/i.test(bookingRaw)) {
        warnings.push({ line: lineNo, message: "Zeile ohne gültiges Datum oder Betrag übersprungen" });
      }
      return;
    }
    const split = splitBuchungstext(row["Buchungstext"] ?? "");
    const type = cleanText(row["Vorgang"]);
    transactions.push({
      id: makeTransactionId(["comdirect", bookingDate, amount, split.counterparty, split.purpose, i]),
      bookingDate,
      valueDate: parseDate(row["Wertstellung (Valuta)"] ?? ""),
      counterparty: split.counterparty,
      purpose: split.purpose,
      amount,
      currency: "EUR",
      type,
      bank: "comdirect",
    });
  });
  return { bank: "comdirect", transactions, warnings, skipped };
}
