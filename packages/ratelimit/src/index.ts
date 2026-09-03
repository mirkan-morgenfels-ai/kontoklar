import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface LimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

export interface Limiter {
  limit(identifier: string): Promise<LimitResult>;
}

export interface RateLimitOptions {
  requests?: number;
  window?: `${number} ${"s" | "m" | "h" | "d"}`;
  prefix?: string;
  redis?: Redis;
}

export function hasUpstashEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function createRateLimiter(options: RateLimitOptions = {}): Limiter {
  const redis = options.redis ?? Redis.fromEnv();
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(options.requests ?? 30, options.window ?? "1 d"),
    prefix: options.prefix ?? "rl:categorize",
    analytics: false,
  });
  return {
    async limit(identifier) {
      const r = await ratelimit.limit(identifier);
      return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
    },
  };
}

export class RateLimitError extends Error {
  readonly status = 429;
  readonly reset: number;
  constructor(reset: number) {
    super("Tageslimit erreicht");
    this.reset = reset;
  }
}

export async function assertLimit(limiter: Limiter, identifier: string): Promise<LimitResult> {
  const result = await limiter.limit(identifier);
  if (!result.success) throw new RateLimitError(result.reset);
  return result;
}

export class TurnstileError extends Error {
  readonly status = 403;
  readonly codes: string[];
  constructor(codes: string[]) {
    super("Bot-Prüfung fehlgeschlagen");
    this.codes = codes;
  }
}

export interface TurnstileVerifyOptions {
  secret?: string;
  fetchImpl?: typeof fetch;
  endpoint?: string;
}

interface TurnstileResponse {
  success: boolean;
  "error-codes"?: string[];
}

export const TURNSTILE_TEST_SECRET_PASS = "1x0000000000000000000000000000000AA";
export const TURNSTILE_TEST_SITEKEY_PASS = "1x00000000000000000000AA";

export async function verifyTurnstile(token: string | undefined, remoteIp: string | undefined, options: TurnstileVerifyOptions = {}): Promise<void> {
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (!token) throw new TurnstileError(["missing-input-response"]);
  const fetchImpl = options.fetchImpl ?? fetch;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);
  const res = await fetchImpl(options.endpoint ?? "https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new TurnstileError([`http-${res.status}`]);
  const data = (await res.json()) as TurnstileResponse;
  if (!data.success) throw new TurnstileError(data["error-codes"] ?? ["unknown"]);
}

export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}
