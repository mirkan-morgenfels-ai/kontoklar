export type LimitedBody = { ok: true; text: string; bytes: number } | { ok: false; bytes: number };

export async function readBodyWithLimit(request: Request, maxBytes: number): Promise<LimitedBody> {
  if (!request.body) return { ok: true, text: "", bytes: 0 };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { ok: false, bytes };
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(merged), bytes };
}
