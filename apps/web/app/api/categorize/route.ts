import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { assertLimit, clientIpFromHeaders, createRateLimiter, hasUpstashEnv, RateLimitError, TurnstileError, verifyTurnstile } from "@portfolio/ratelimit";
import { createOpenAiEmbed, createOpenAiFallback, createRedisCache, loadLabeledVectors, openAiClient } from "@/lib/kontoklar/providers";
import { categorizeTexts, sanitizeTexts, type CategorizeDeps } from "@/lib/kontoklar/server";
import type { ApiDisabledResponse } from "@/lib/kontoklar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 200_000;

function disabled(reason: string) {
  const body: ApiDisabledResponse = { disabled: true, reason };
  return NextResponse.json(body, { status: 503 });
}

export async function POST(request: Request) {
  const client = openAiClient();
  if (!client) return disabled("API-Schritt deaktiviert: kein OPENAI_API_KEY gesetzt. Die Regel-Engine arbeitet weiter.");

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Anfrage zu groß" }, { status: 413 });

  let payload: { texts?: unknown; turnstileToken?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }
  const { texts, error } = sanitizeTexts(payload.texts);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (texts.length === 0) return NextResponse.json({ results: [], stats: { cached: 0, embedded: 0, fallback: 0 } });

  const ip = clientIpFromHeaders(request.headers);
  try {
    await verifyTurnstile(typeof payload.turnstileToken === "string" ? payload.turnstileToken : undefined, ip);
  } catch (e) {
    if (e instanceof TurnstileError) return NextResponse.json({ error: "Bot-Prüfung fehlgeschlagen" }, { status: 403 });
    return NextResponse.json({ error: "Bot-Prüfung nicht erreichbar" }, { status: 502 });
  }

  let redis: Redis | null = null;
  if (hasUpstashEnv()) {
    redis = Redis.fromEnv();
    try {
      await assertLimit(createRateLimiter({ redis }), ip);
    } catch (e) {
      if (e instanceof RateLimitError || (e as { status?: number }).status === 429) {
        const reset = (e as { reset?: number }).reset ?? Date.now() + 60_000;
        return NextResponse.json({ error: "Tageslimit erreicht. Die Regel-Engine bleibt aktiv." }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))) } });
      }
      console.error("ratelimit unavailable", (e as Error).name);
      return NextResponse.json({ error: "Rate-Limit nicht erreichbar. Die Regel-Engine bleibt aktiv." }, { status: 503 });
    }
  }

  const labeled = await loadLabeledVectors();
  if (labeled.length === 0) return disabled("API-Schritt deaktiviert: Beispielset data/k2/labeled-embeddings.json fehlt. Die Regel-Engine arbeitet weiter.");
  const deps: CategorizeDeps = {
    cache: redis ? createRedisCache(redis) : null,
    embed: createOpenAiEmbed(client),
    labeled,
    fallback: createOpenAiFallback(client),
  };

  try {
    const response = await categorizeTexts(texts, deps);
    return NextResponse.json(response, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("categorize failed", (e as Error).name, (e as { status?: number }).status ?? "");
    return NextResponse.json({ error: "Kategorisierung derzeit nicht verfügbar. Die Regel-Engine bleibt aktiv." }, { status: 502 });
  }
}
