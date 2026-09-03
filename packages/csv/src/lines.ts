import Papa from "papaparse";

export function splitLines(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").split("\n");
}

export function findHeaderLine(lines: string[], predicate: (line: string) => boolean, maxScan = 30): number {
  const limit = Math.min(lines.length, maxScan);
  for (let i = 0; i < limit; i++) {
    if (predicate(lines[i] ?? "")) return i;
  }
  return -1;
}

export function parseFromHeader(lines: string[], headerIndex: number, delimiter: string): { rows: Record<string, string>[]; errors: Papa.ParseError[] } {
  const body = lines.slice(headerIndex).join("\n");
  const result = Papa.parse<Record<string, string>>(body, {
    header: true,
    delimiter,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return { rows: result.data, errors: result.errors };
}

export function detectDelimiter(line: string): string {
  const candidates = [";", ",", "\t", "|"];
  let best = ";";
  let bestCount = -1;
  for (const c of candidates) {
    const count = line.split(c).length - 1;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

export function headerCells(line: string, delimiter: string): string[] {
  const parsed = Papa.parse<string[]>(line, { delimiter, header: false });
  const first = parsed.data[0] ?? [];
  return first.map((c) => c.trim());
}
