export type FileKind = "text" | "pdf" | "zip" | "binary" | "empty";

export function detectFileKind(buffer: ArrayBuffer): FileKind {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return "empty";
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  if (bytes.length >= 2 && bytes[0] === 0x50 && bytes[1] === 0x4b) return "zip";
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  let control = 0;
  for (const b of sample) {
    if (b === 0) return "binary";
    if (b < 0x09 || (b > 0x0d && b < 0x20)) control++;
  }
  return control > sample.length * 0.05 ? "binary" : "text";
}

export function decodeCsvBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return hasBom ? text.replace(/^\uFEFF/, "") : text;
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
