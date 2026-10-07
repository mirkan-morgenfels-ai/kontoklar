const UNIT_PATTERN = /^(.*?\d)(\s?(?:%|€)(?:\s?p\.\s?a\.)?)$/;

export interface ValueUnit {
  number: string;
  unit: string;
}

export function splitValueUnit(value: string): ValueUnit | null {
  const match = UNIT_PATTERN.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  return { number: match[1], unit: match[2] };
}
