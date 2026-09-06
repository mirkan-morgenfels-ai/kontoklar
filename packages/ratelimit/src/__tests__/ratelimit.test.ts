import { describe, expect, test, vi } from "vitest";
import { assertLimit, clientIpFromHeaders, hasUpstashEnv, RateLimitError, TurnstileError, verifyTurnstile, type Limiter } from "../index";

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
});

describe("verifyTurnstile", () => {
  test("ohne Secret wird nicht geprüft", async () => {
    const fetchImpl = vi.fn();
    await expect(verifyTurnstile(undefined, undefined, { secret: undefined, fetchImpl: fetchImpl as unknown as typeof fetch })).resolves.toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
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
  test("clientIpFromHeaders bevorzugt x-real-ip, dann die erste x-forwarded-for-Adresse", () => {
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "5.5.5.5, 10.0.0.1" }))).toBe("5.5.5.5");
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "6.6.6.6", "x-forwarded-for": "1.1.1.1" }))).toBe("6.6.6.6");
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
  test("hasUpstashEnv", () => {
    expect(hasUpstashEnv({})).toBe(false);
    expect(hasUpstashEnv({ UPSTASH_REDIS_REST_URL: "u", UPSTASH_REDIS_REST_TOKEN: "t" })).toBe(true);
  });
});
