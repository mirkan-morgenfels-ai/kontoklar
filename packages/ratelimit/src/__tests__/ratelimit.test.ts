import { afterEach, describe, expect, test, vi } from "vitest";
import type { Redis } from "@upstash/redis";
import {
  assertLimit,
  clientIpFromHeaders,
  createRateLimiter,
  hasUpstashEnv,
  IPV6_RATE_LIMIT_PREFIX_BITS,
  IpHashConfigError,
  isTurnstileTestKey,
  pseudonymizeIp,
  RATE_LIMIT_KEY_TTL_MS,
  RATE_LIMIT_PREFIX,
  RATE_LIMIT_REQUESTS,
  RATE_LIMIT_TIMEOUT_MS,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_WINDOW_MS,
  RateLimitError,
  rateLimitSubject,
  RateLimitUnavailableError,
  TURNSTILE_TEST_SECRET_PASS,
  TURNSTILE_TEST_SECRETS,
  TURNSTILE_TEST_SITEKEYS,
  TurnstileConfigError,
  TurnstileError,
  verifyTurnstile,
  type Limiter,
} from "../index";

function fakeLimiter(allowed: number): Limiter {
  let used = 0;
  return {
    async limit() {
      used += 1;
      const success = used <= allowed;
      return { success, limit: allowed, remaining: Math.max(allowed - used, 0), reset: 1_700_000_000_000 };
    },
  };
}

describe("assertLimit", () => {
  test("lässt Aufrufe bis zum Limit durch und wirft danach 429", async () => {
    const limiter = fakeLimiter(2);
    await expect(assertLimit(limiter, "1.2.3.4")).resolves.toMatchObject({ success: true, remaining: 1 });
    await expect(assertLimit(limiter, "1.2.3.4")).resolves.toMatchObject({ success: true, remaining: 0 });
    await expect(assertLimit(limiter, "1.2.3.4")).rejects.toBeInstanceOf(RateLimitError);
  });
  test("RateLimitError trägt Status 429", async () => {
    const limiter = fakeLimiter(0);
    try {
      await assertLimit(limiter, "x");
    } catch (e) {
      expect((e as RateLimitError).status).toBe(429);
      expect((e as RateLimitError).reset).toBe(1_700_000_000_000);
    }
  });
  test("Timeout-Antwort der Bibliothek (success: true, reason: timeout) wird nicht durchgelassen, sondern 503", async () => {
    const limiter: Limiter = { limit: async () => ({ success: true, limit: 0, remaining: 0, reset: 0, reason: "timeout" }) };
    const error = await assertLimit(limiter, "x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(RateLimitUnavailableError);
    expect((error as RateLimitUnavailableError).status).toBe(503);
  });
});

describe("createRateLimiter mit @upstash/ratelimit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("Upstash antwortet nicht: nach 4.999 ms noch offen, nach 5.000 ms RateLimitUnavailableError statt Durchlassen", async () => {
    vi.useFakeTimers();
    const hang = vi.fn(() => new Promise<never>(() => {}));
    const limiter = createRateLimiter({ redis: { evalsha: hang, eval: hang } as unknown as Redis });
    let settled = false;
    const outcome = assertLimit(limiter, "id").then(
      () => "durchgelassen",
      (e: unknown) => e,
    );
    void outcome.finally(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(4_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toBeInstanceOf(RateLimitUnavailableError);
    expect(hang).toHaveBeenCalledTimes(1);
    expect(RATE_LIMIT_TIMEOUT_MS).toBe(5_000);
  });

  test("installiertes Sliding-Window-Skript: Ablaufzeit 2 × 86.400.000 ms + 1.000 ms = 172.801.000 ms, Fenster je UTC-Kalendertag", async () => {
    vi.useFakeTimers();
    const evals: { script: string; keys: string[]; args: unknown[] }[] = [];
    const redis = {
      evalsha: vi.fn(async () => {
        throw new Error("NOSCRIPT No matching script");
      }),
      eval: vi.fn(async (script: string, keys: string[], args: unknown[]) => {
        evals.push({ script, keys, args });
        return [29, 30];
      }),
    } as unknown as Redis;
    vi.setSystemTime(Date.UTC(2026, 9, 7) - 1);
    await expect(createRateLimiter({ redis }).limit("abc")).resolves.toMatchObject({ success: true, remaining: 29, limit: 30 });
    vi.setSystemTime(Date.UTC(2026, 9, 7));
    await createRateLimiter({ redis }).limit("abc");
    expect(evals).toHaveLength(2);
    const [beforeMidnight, atMidnight] = evals;
    expect(beforeMidnight?.keys.slice(0, 2)).toEqual([`${RATE_LIMIT_PREFIX}:abc:20732`, `${RATE_LIMIT_PREFIX}:abc:20731`]);
    expect(atMidnight?.keys.slice(0, 2)).toEqual([`${RATE_LIMIT_PREFIX}:abc:20733`, `${RATE_LIMIT_PREFIX}:abc:20732`]);
    expect(atMidnight?.args).toEqual([30, Date.UTC(2026, 9, 7), 86_400_000, 1]);
    const script = atMidnight?.script ?? "";
    expect(script).toMatch(/local window\s*=\s*ARGV\[3\]/);
    expect(script).toContain('redis.call("PEXPIRE", currentKey, window * 2 + 1000)');
    const window = atMidnight?.args[2] as number;
    expect(window * 2 + 1000).toBe(RATE_LIMIT_KEY_TTL_MS);
  });
});

describe("verifyTurnstile", () => {
  const savedSecret = process.env.TURNSTILE_SECRET_KEY;
  afterEach(() => {
    if (savedSecret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
    else process.env.TURNSTILE_SECRET_KEY = savedSecret;
  });

  test("ohne Secret wird nicht durchgelassen, sondern mit Konfigurationsfehler abgelehnt", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const fetchImpl = vi.fn();
    await expect(verifyTurnstile("tok", "1.1.1.1", { fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toBeInstanceOf(TurnstileConfigError);
    await expect(verifyTurnstile("tok", "1.1.1.1", { secret: "", fetchImpl: fetchImpl as unknown as typeof fetch })).rejects.toBeInstanceOf(TurnstileConfigError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  test("bewusst injizierter Testschlüssel wird wie ein echtes Secret an die Prüfung übergeben", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect((init?.body as URLSearchParams).get("secret")).toBe(TURNSTILE_TEST_SECRET_PASS);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    await expect(verifyTurnstile("tok", undefined, { secret: TURNSTILE_TEST_SECRET_PASS, fetchImpl: fetchImpl as unknown as typeof fetch })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls[0]?.[1]?.body as URLSearchParams).has("remoteip")).toBe(false);
  });
  test("mit Secret aber ohne Token schlägt fehl", async () => {
    await expect(verifyTurnstile(undefined, "1.1.1.1", { secret: "s" })).rejects.toBeInstanceOf(TurnstileError);
  });
  test("erfolgreiche Prüfung", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = init?.body as URLSearchParams;
      expect(body.get("secret")).toBe("secret-1");
      expect(body.get("response")).toBe("tok");
      expect(body.get("remoteip")).toBe("9.9.9.9");
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });
    await expect(verifyTurnstile("tok", "9.9.9.9", { secret: "secret-1", fetchImpl: fetchImpl as unknown as typeof fetch })).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  test("abgelehnte Prüfung liefert Fehlercodes", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: false, "error-codes": ["invalid-input-response"] }), { status: 200 }));
    try {
      await verifyTurnstile("bad", undefined, { secret: "s", fetchImpl: fetchImpl as unknown as typeof fetch });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TurnstileError);
      expect((e as TurnstileError).codes).toEqual(["invalid-input-response"]);
      expect((e as TurnstileError).status).toBe(403);
    }
  });
});

describe("Hilfsfunktionen", () => {
  test("clientIpFromHeaders bevorzugt x-real-ip, dann die erste x-forwarded-for-Adresse, dann cf-connecting-ip", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "5.5.5.5, 10.0.0.1" }))).toBe("5.5.5.5");
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "6.6.6.6", "x-forwarded-for": "1.1.1.1" }))).toBe("6.6.6.6");
    expect(clientIpFromHeaders(new Headers({ "cf-connecting-ip": " 2001:db8::7 " }))).toBe("2001:db8::7");
  });
  test("clientIpFromHeaders liefert ohne gültige IP undefined statt eines gemeinsamen Platzhalters", () => {
    expect(clientIpFromHeaders(new Headers())).toBeUndefined();
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "unknown" }))).toBeUndefined();
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "999.1.1.1", "x-forwarded-for": "1.1.1.1" }))).toBeUndefined();
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": " , 1.1.1.1" }))).toBeUndefined();
  });
  test("hasUpstashEnv", () => {
    expect(hasUpstashEnv({})).toBe(false);
    expect(hasUpstashEnv({ UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" })).toBe(true);
  });
});

describe("pseudonymizeIp", () => {
  const secret = "test-secret-0123456789abcdef0123456789";

  test("ist HMAC-SHA256 (RFC 4231, Testfall 2)", () => {
    expect(pseudonymizeIp("what do ya want for nothing?", "Jefe")).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });
  test("gleiche IP ergibt denselben Hash, andere IP oder anderer Schlüssel einen anderen", () => {
    const a = pseudonymizeIp("203.0.113.7", secret);
    expect(pseudonymizeIp("203.0.113.7", secret)).toBe(a);
    expect(pseudonymizeIp("203.0.113.8", secret)).not.toBe(a);
    expect(pseudonymizeIp("203.0.113.7", `${secret}x`)).not.toBe(a);
  });
  test("der Hash enthält die IP nicht und hat 64 Hex-Zeichen", () => {
    const hash = pseudonymizeIp("203.0.113.7", secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("203.0.113.7");
  });
  test("ohne Schlüssel wird nicht gehasht, sondern abgelehnt", () => {
    expect(() => pseudonymizeIp("203.0.113.7", "")).toThrow(IpHashConfigError);
  });
});

describe("rateLimitSubject", () => {
  test("IPv4 bleibt unverändert", () => {
    expect(rateLimitSubject("203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitSubject("203.0.113.8")).not.toBe(rateLimitSubject("203.0.113.7"));
  });
  test("IPv6 wird auf die ersten 64 Bit (4 Gruppen) gekürzt: zwei Adressen im selben /64 ergeben denselben Schlüssel", () => {
    expect(IPV6_RATE_LIMIT_PREFIX_BITS).toBe(64);
    expect(rateLimitSubject("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd:12::/64");
    expect(rateLimitSubject("2001:0db8:abcd:0012:ffff:ffff:ffff:ffff")).toBe("2001:db8:abcd:12::/64");
    expect(rateLimitSubject("2001:db8:abcd:12::1")).toBe("2001:db8:abcd:12::/64");
    expect(rateLimitSubject("2001:db8:abcd:13::1")).toBe("2001:db8:abcd:13::/64");
    const secret = "test-secret-0123456789abcdef0123456789";
    expect(pseudonymizeIp(rateLimitSubject("2001:db8:abcd:12::1"), secret)).toBe(pseudonymizeIp(rateLimitSubject("2001:db8:abcd:12:aaaa::2"), secret));
    expect(pseudonymizeIp(rateLimitSubject("2001:db8:abcd:13::1"), secret)).not.toBe(pseudonymizeIp(rateLimitSubject("2001:db8:abcd:12::1"), secret));
  });
  test("IPv6-Kurzformen, Zonen-Index und eingebettete IPv4", () => {
    expect(rateLimitSubject("2001:db8::")).toBe("2001:db8:0:0::/64");
    expect(rateLimitSubject("::1")).toBe("0:0:0:0::/64");
    expect(rateLimitSubject("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
    expect(rateLimitSubject("64:ff9b::192.0.2.33")).toBe("64:ff9b:0:0::/64");
  });
  test("IPv4-gemappte IPv6-Adresse zählt wie die IPv4-Adresse", () => {
    expect(rateLimitSubject("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitSubject("::ffff:cb00:7107")).toBe("203.0.113.7");
  });
});

describe("Cloudflare-Testschlüssel", () => {
  test("alle drei Test-Secrets und fünf Test-Websiteschlüssel werden erkannt", () => {
    expect(TURNSTILE_TEST_SECRETS).toHaveLength(3);
    expect(TURNSTILE_TEST_SITEKEYS).toHaveLength(5);
    for (const key of [...TURNSTILE_TEST_SECRETS, ...TURNSTILE_TEST_SITEKEYS]) expect(isTurnstileTestKey(key)).toBe(true);
  });
  test("andere Werte gelten nicht als Testschlüssel", () => {
    expect(isTurnstileTestKey("secret-1")).toBe(false);
    expect(isTurnstileTestKey("")).toBe(false);
    expect(isTurnstileTestKey(TURNSTILE_TEST_SECRET_PASS.toLowerCase())).toBe(false);
  });
});

describe("Rate-Limit-Kennzahlen", () => {
  test("30 Aufrufe je Tagesfenster; Upstash löscht einen Zähler nach 2 × 86.400.000 ms + 1.000 ms = 172.801.000 ms", () => {
    expect(RATE_LIMIT_REQUESTS).toBe(30);
    expect(RATE_LIMIT_WINDOW).toBe("1 d");
    expect(RATE_LIMIT_WINDOW_MS).toBe(86_400_000);
    expect(RATE_LIMIT_KEY_TTL_MS).toBe(172_801_000);
    expect(RATE_LIMIT_KEY_TTL_MS / 3_600_000).toBeCloseTo(48.0003, 4);
  });
});
