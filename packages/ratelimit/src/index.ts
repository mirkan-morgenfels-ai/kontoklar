import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const RATE_LIMIT_REQUESTS = 30;
export const RATE_LIMIT_WINDOW = "1 d";
export const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RATE_LIMIT_KEY_TTL_MS = RATE_LIMIT_WINDOW_MS * 2 + 1000;
export const RATE_LIMIT_PREFIX = "rl:categorize";
export const RATE_LIMIT_TIMEOUT_MS = 5000;
export const IPV6_RATE_LIMIT_PREFIX_BITS = 64;

export interface LimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  reason?: string;
}

export interface Limiter {
  limit(identifier: string): Promise<LimitResult>;
}

export interface RateLimitOptions {
  requests?: number;
  window?: `${number} ${"s" | "m" | "h" | "d"}`;
  prefix?: string;
  redis?: Redis;
  timeoutMs?: number;
}

export function hasUpstashEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function createRateLimiter(options: RateLimitOptions = {}): Limiter {
  const redis = options.redis ?? Redis.fromEnv();
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(options.requests ?? RATE_LIMIT_REQUESTS, options.window ?? RATE_LIMIT_WINDOW),
    prefix: options.prefix ?? RATE_LIMIT_PREFIX,
    analytics: false,
    timeout: options.timeoutMs ?? RATE_LIMIT_TIMEOUT_MS,
  });
  return {
    async limit(identifier) {
      const r = await ratelimit.limit(identifier);
      return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset, reason: r.reason };
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

export class RateLimitUnavailableError extends Error {
  readonly status = 503;
  constructor() {
    super("Rate-Limit nicht erreichbar");
  }
}

export async function assertLimit(limiter: Limiter, identifier: string): Promise<LimitResult> {
  const result = await limiter.limit(identifier);
  if (result.reason === "timeout") throw new RateLimitUnavailableError();
  if (!result.success) throw new RateLimitError(result.reset);
  return result;
}

export class IpHashConfigError extends Error {
  constructor() {
    super("IP_HASH_SECRET fehlt");
  }
}

export function pseudonymizeIp(ip: string, secret: string): string {
  if (!secret) throw new IpHashConfigError();
  return createHmac("sha256", secret).update(ip, "utf8").digest("hex");
}

function ipv6Groups(ip: string): number[] {
  const address = ip.split("%")[0] ?? "";
  const lastColon = address.lastIndexOf(":");
  const tail = address.slice(lastColon + 1);
  let hex = address;
  if (tail.includes(".")) {
    const [a = 0, b = 0, c = 0, d = 0] = tail.split(".").map(Number);
    hex = `${address.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const parse = (part: string) => (part ? part.split(":").map((group) => parseInt(group, 16)) : []);
  const [head = "", rest] = hex.split("::");
  const front = parse(head);
  if (rest === undefined) return front;
  const back = parse(rest);
  return [...front, ...new Array<number>(8 - front.length - back.length).fill(0), ...back];
}

export function rateLimitSubject(ip: string): string {
  if (isIP(ip) !== 6) return ip;
  const groups = ipv6Groups(ip);
  const [g0, g1, g2, g3, g4, g5, g6 = 0, g7 = 0] = groups;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) return [g6 >> 8, g6 & 255, g7 >> 8, g7 & 255].join(".");
  const prefix = groups.slice(0, IPV6_RATE_LIMIT_PREFIX_BITS / 16).map((group) => group.toString(16));
  return `${prefix.join(":")}::/${IPV6_RATE_LIMIT_PREFIX_BITS}`;
}

export class TurnstileError extends Error {
  readonly status = 403;
  readonly codes: string[];
  constructor(codes: string[]) {
    super("Bot-Prüfung fehlgeschlagen");
    this.codes = codes;
  }
}

export class TurnstileConfigError extends Error {
  readonly status = 503;
  constructor() {
    super("TURNSTILE_SECRET_KEY fehlt");
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
export const TURNSTILE_TEST_SECRETS = [TURNSTILE_TEST_SECRET_PASS, "2x0000000000000000000000000000000AA", "3x0000000000000000000000000000000AA"] as const;
export const TURNSTILE_TEST_SITEKEYS = [TURNSTILE_TEST_SITEKEY_PASS, "2x00000000000000000000AB", "1x00000000000000000000BB", "2x00000000000000000000BB", "3x00000000000000000000FF"] as const;

export function isTurnstileTestKey(value: string): boolean {
  return (TURNSTILE_TEST_SECRETS as readonly string[]).includes(value) || (TURNSTILE_TEST_SITEKEYS as readonly string[]).includes(value);
}

export async function verifyTurnstile(token: string | undefined, remoteIp: string | undefined, options: TurnstileVerifyOptions = {}): Promise<void> {
  const secret = options.secret ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secret) throw new TurnstileConfigError();
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

export function clientIpFromHeaders(headers: Headers): string | undefined {
  const candidate = headers.get("x-real-ip")?.trim() || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("cf-connecting-ip")?.trim();
  return candidate && isIP(candidate) !== 0 ? candidate : undefined;
}
