import type { Bank, GenericMapping, ParseResult } from "./types";
import { detectBank } from "./detect";
import { stripBom } from "./decode";
import { parseDkb } from "./parsers/dkb";
import { parseIng } from "./parsers/ing";
import { parseComdirect } from "./parsers/comdirect";
import { parseN26 } from "./parsers/n26";
import { parseGeneric } from "./parsers/generic";

export type { Bank, Transaction, ParseResult, ParseWarning, GenericMapping } from "./types";
export { detectBank } from "./detect";
export { decodeCsvBytes, stripBom } from "./decode";
export { parseAmount, parseDate, cleanText, makeTransactionId } from "./normalize";
export { parseDkb } from "./parsers/dkb";
export { parseIng } from "./parsers/ing";
export { parseComdirect, splitBuchungstext } from "./parsers/comdirect";
export { parseN26 } from "./parsers/n26";
export { parseGeneric, previewHeaders } from "./parsers/generic";
export type { HeaderPreview } from "./parsers/generic";

export const SUPPORTED_BANKS: { id: Bank; label: string }[] = [
  { id: "dkb", label: "DKB" },
  { id: "ing", label: "ING" },
  { id: "comdirect", label: "comdirect" },
  { id: "n26", label: "N26" },
  { id: "generic", label: "Andere Bank (Spalten zuordnen)" },
];

export function parseBankCsv(text: string, bank?: Bank, mapping?: GenericMapping): ParseResult {
  const clean = stripBom(text);
  const resolved = bank ?? detectBank(clean);
  switch (resolved) {
    case "dkb":
      return parseDkb(clean);
    case "ing":
      return parseIng(clean);
    case "comdirect":
      return parseComdirect(clean);
    case "n26":
      return parseN26(clean);
    case "generic":
      if (!mapping) throw new Error("Für das generische Format ist ein Spalten-Mapping nötig");
      return parseGeneric(clean, mapping);
    default:
      throw new Error("Bankformat nicht erkannt. Bitte Bank wählen oder Spalten zuordnen.");
  }
}
