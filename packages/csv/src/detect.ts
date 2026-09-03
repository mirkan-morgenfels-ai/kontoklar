import type { Bank } from "./types";
import { splitLines } from "./lines";
import { isDkb } from "./parsers/dkb";
import { isIng } from "./parsers/ing";
import { isComdirect } from "./parsers/comdirect";
import { isN26 } from "./parsers/n26";

export function detectBank(text: string): Bank | "unknown" {
  const lines = splitLines(text).slice(0, 30);
  if (isDkb(lines)) return "dkb";
  if (isComdirect(lines)) return "comdirect";
  if (isIng(lines)) return "ing";
  if (isN26(lines)) return "n26";
  return "unknown";
}
