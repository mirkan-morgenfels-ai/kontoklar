import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  assertLimit,
  clientIpFromHeaders,
  createRateLimiter,
  pseudonymizeIp,
  RateLimitError,
  rateLimitSubject,
  TurnstileConfigError,
  TurnstileError,
  verifyTurnstile,
} from "@portfolio/ratelimit";
import { readBodyWithLimit } from "@/lib/kontoklar/body";
import { missingConfigReason, readApiConfig, turnstileConfigured } from "@/lib/kontoklar/config";
import { createOpenAiEmbed, createOpenAiFallback, createRedisCache, loadLabeledVectors, openAiClient } from "@/lib/kontoklar/providers";
import { categorizeTexts, sanitizeTexts, type CategorizeDeps } from "@/lib/kontoklar/server";
import { MAX_BODY_BYTES, type ApiDisabledResponse, type ApiStatusResponse } from "@/lib/kontoklar/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LABELED_MISSING = "Das Beispielset mit Vektoren (data/k2/labeled-embeddings.json) fehlt auf dem Server.";
const NO_STORE = { "cache-control": "no-store" };

function disabled(reason: string) {
  const body: ApiDisabledResponse = { disabled: true, reason: `API-Schritt deaktiviert. ${reason} Die Regel-Engine arbeitet weiter.` };
  return NextResponse.json(body, { status: 503, headers: NO_STORE });
}

function tooLarge() {
  return NextResponse.json({ error: "Anfrage zu groß" }, { status: 413, headers: NO_STORE });
}

export async function GET() {
  const check = readApiConfig();
  const turnstile = turnstileConfigured(check);
  let body: ApiStatusResponse;
  if (!check.ok) {
    body = { enabled: false, turnstile, reason: missingConfigReason(check.missing, check.testKeys), missing: check.missing };
  } else if ((await loadLabeledVectors()).length === 0) {
    body = { enabled: false, turnstile, reason: LABELED_MISSING };
  } else {
    body = { enabled: true, turnstile };
  }
  return NextResponse.json(body, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const check = readApiConfig();
  if (!check.ok) return disabled(missingConfigReason(check.missing, check.testKeys));
  const { config } = check;
  const client = openAiClient(config.openAiKey);
  if (!client) return disabled(missingConfigReason(["OPENAI_API_KEY"]));
  const labeled = await loadLabeledVectors();
  if (labeled.length === 0) return disabled(LABELED_MISSING);

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) return tooLarge();
  const raw = await readBodyWithLimit(request, MAX_BODY_BYTES);
  if (!raw.ok) return tooLarge();

  let payload: { texts?: unknown; turnstileToken?: unknown };
  try {
    const parsed: unknown = JSON.parse(raw.text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new SyntaxError("kein Objekt");
    payload = parsed as typeof payload;
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }
  const { texts, error } = sanitizeTexts(payload.texts);
  if (error) return NextResponse.json({ error }, { status: 400 });
  if (texts.length === 0) return NextResponse.json({ results: [], stats: { cached: 0, embedded: 0, fallback: 0 } });

  const ip = clientIpFromHeaders(request.headers);
  if (!ip) return NextResponse.json({ error: "Client-Adresse nicht ermittelbar, das Rate-Limit ist nicht anwendbar. Die Regel-Engine bleibt aktiv." }, { status: 503 });
  try {
    await verifyTurnstile(typeof payload.turnstileToken === "string" ? payload.turnstileToken : undefined, ip, { secret: config.turnstileSecret });
  } catch (e) {
    if (e instanceof TurnstileError) return NextResponse.json({ error: "Bot-Prüfung fehlgeschlagen" }, { status: 403 });
    if (e instanceof TurnstileConfigError) return disabled(missingConfigReason(["TURNSTILE_SECRET_KEY"]));
    return NextResponse.json({ error: "Bot-Prüfung nicht erreichbar" }, { status: 502 });
  }

  const redis = new Redis({ url: config.upstashUrl, token: config.upstashToken });
  try {
    await assertLimit(createRateLimiter({ redis }), pseudonymizeIp(rateLimitSubject(ip), config.ipHashSecret));
  } catch (e) {
    if (e instanceof RateLimitError || (e as { status?: number }).status === 429) {
      const reset = (e as { reset?: number }).reset ?? Date.now() + 60_000;
      return NextResponse.json({ error: "Tageslimit erreicht. Die Regel-Engine bleibt aktiv." }, { status: 429, headers: { "retry-after": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))) } });
    }
    console.error("ratelimit unavailable", (e as Error).name);
    return NextResponse.json({ error: "Rate-Limit nicht erreichbar. Die Regel-Engine bleibt aktiv." }, { status: 503 });
  }

  const deps: CategorizeDeps = {
    cache: createRedisCache(redis),
    embed: createOpenAiEmbed(client),
    labeled,
    fallback: createOpenAiFallback(client),
  };

  try {
    const response = await categorizeTexts(texts, deps);
    return NextResponse.json(response, { headers: NO_STORE });
  } catch (e) {
    console.error("categorize failed", (e as Error).name, (e as { status?: number }).status ?? "");
    return NextResponse.json({ error: "Kategorisierung derzeit nicht verfügbar. Die Regel-Engine bleibt aktiv." }, { status: 502 });
  }
}
