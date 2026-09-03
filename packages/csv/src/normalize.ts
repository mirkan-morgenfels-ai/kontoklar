export type DecimalStyle = "comma" | "dot" | "auto";

export function parseAmount(raw: string, style: DecimalStyle = "auto"): number | null {
  let s = raw.trim().replace(/\u00a0/g, " ");
  if (s === "") return null;
  s = s.replace(/\s*(EUR|€)\s*$/i, "").replace(/^\s*(EUR|€)\s*/i, "").trim();
  let negative = false;
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  } else if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/\s+/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let resolved: "comma" | "dot";
  if (style !== "auto") {
    resolved = style;
  } else if (hasComma && hasDot) {
    resolved = s.lastIndexOf(",") > s.lastIndexOf(".") ? "comma" : "dot";
  } else if (hasComma) {
    resolved = "comma";
  } else if (hasDot) {
    resolved = /^\d{1,3}(\.\d{3})+$/.test(s) ? "comma" : "dot";
  } else {
    resolved = "dot";
  }
  const normalized = resolved === "comma" ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  if (!/^\d*(\.\d+)?$/.test(normalized) || normalized === "" || normalized === ".") return null;
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

export function parseDate(raw: string, format: "dmy" | "iso" | "auto" = "auto"): string | null {
  const s = raw.trim();
  if (s === "") return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso && format !== "dmy") return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(s);
  if (dmy && format !== "iso") {
    const day = dmy[1]!.padStart(2, "0");
    const month = dmy[2]!.padStart(2, "0");
    const yearRaw = dmy[3]!;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const m = Number(month);
    const d = Number(day);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${year}-${month}-${day}`;
  }
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (slash && format !== "iso") {
    return `${slash[3]}-${slash[2]!.padStart(2, "0")}-${slash[1]!.padStart(2, "0")}`;
  }
  return null;
}

export function cleanText(raw: string | undefined | null): string {
  return (raw ?? "").replace(/\s+/g, " ").trim();
}

export function makeTransactionId(parts: (string | number | null | undefined)[]): string {
  const input = parts.map((p) => String(p ?? "")).join("|");
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2654435761) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"));
}
