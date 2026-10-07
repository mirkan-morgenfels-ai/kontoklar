import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { pseudonymizeIp, TURNSTILE_TEST_SECRET_PASS, TURNSTILE_TEST_SITEKEY_PASS } from "@portfolio/ratelimit";
import { apiErrorText } from "../categorize";
import { API_REQUIREMENTS, type ApiEnvName } from "../config";

const embeddingsCreate = vi.fn();
const chatCreate = vi.fn();
const redisStore = new Map<string, string>();
const redisOptions: unknown[] = [];
const limitCalls: string[] = [];
const state = { labeledEmpty: false, limiterDown: false, limiterHangs: false, hangCalls: 0 };
const VALID_TOKEN = "turnstile-ok";
const IP_SECRET = "test-ip-hash-secret-0123456789abcdef";
const DEFAULT_IP = "203.0.113.50";
const turnstileFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
  const body = init?.body as URLSearchParams;
  const success = body.get("response") === VALID_TOKEN && body.get("secret") === "turnstile-secret";
  return new Response(JSON.stringify(success ? { success: true } : { success: false, "error-codes": ["invalid-input-response"] }), { status: 200 });
});

vi.mock("openai", () => ({
  default: class {
    embeddings = { create: embeddingsCreate };
    chat = { completions: { create: chatCreate } };
  },
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor(options: unknown) {
      redisOptions.push(options);
    }
    async mget(...keys: string[]) {
      return keys.map((k) => redisStore.get(k) ?? null);
    }
    pipeline() {
      const ops: [string, string][] = [];
      return {
        set: (k: string, v: string) => ops.push([k, v]),
        exec: async () => {
          for (const [k, v] of ops) redisStore.set(k, v);
        },
      };
    }
  },
}));

vi.mock("@portfolio/ratelimit", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@portfolio/ratelimit")>();
  const hang = () => {
    state.hangCalls += 1;
    return new Promise<never>(() => {});
  };
  return {
    ...mod,
    createRateLimiter: () =>
      state.limiterHangs
        ? mod.createRateLimiter({ redis: { evalsha: hang, eval: hang } as never, timeoutMs: 20 })
        : {
            async limit(id: string) {
              if (state.limiterDown) throw new Error("upstash down");
              limitCalls.push(id);
              const success = limitCalls.filter((x) => x === id).length <= 2;
              return { success, limit: 2, remaining: 0, reset: Date.now() + 1000 };
            },
          },
  };
});

vi.mock("../providers", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../providers")>();
  return {
    ...mod,
    loadLabeledVectors: async () =>
      state.labeledEmpty
        ? []
        : [
            { text: "REWE", category: "Lebensmittel", vector: [1, 0, 0] },
            { text: "DM", category: "Drogerie & Haushalt", vector: [0, 1, 0] },
            { text: "NETFLIX", category: "Abos & Medien", vector: [0, 0, 1] },
          ],
  };
});

const FULL_ENV: Record<ApiEnvName, string> = {
  OPENAI_API_KEY: "test-openai",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-upstash-token",
  TURNSTILE_SECRET_KEY: "turnstile-secret",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "turnstile-site",
  IP_HASH_SECRET: IP_SECRET,
};

function configure(except: ApiEnvName[] = []) {
  for (const [name, value] of Object.entries(FULL_ENV) as [ApiEnvName, string][]) {
    if (except.includes(name)) delete process.env[name];
    else process.env[name] = value;
  }
}

async function get() {
  const { GET } = await import("../../../app/api/categorize/route");
  return GET();
}

function withToken(body: unknown): unknown {
  if (typeof body === "object" && body !== null && !Array.isArray(body) && !("turnstileToken" in body)) return { ...body, turnstileToken: VALID_TOKEN };
  return body;
}

async function post(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import("../../../app/api/categorize/route");
  const req = new Request("http://localhost/api/categorize", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": DEFAULT_IP, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(withToken(body)),
  });
  return POST(req);
}

async function postStream(chunks: string[], headers: Record<string, string> = {}) {
  const { POST } = await import("../../../app/api/categorize/route");
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  const req = new Request("http://localhost/api/categorize", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": DEFAULT_IP, ...headers },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return POST(req);
}

function expectNoExternalCalls() {
  expect(embeddingsCreate).not.toHaveBeenCalled();
  expect(chatCreate).not.toHaveBeenCalled();
  expect(turnstileFetch).not.toHaveBeenCalled();
  expect(limitCalls).toHaveLength(0);
}

describe("/api/categorize", () => {
  const env = { ...process.env };
  beforeAll(async () => {
    await import("../../../app/api/categorize/route");
  }, 60_000);
  beforeEach(() => {
    redisStore.clear();
    redisOptions.length = 0;
    limitCalls.length = 0;
    state.labeledEmpty = false;
    state.limiterDown = false;
    state.limiterHangs = false;
    state.hangCalls = 0;
    embeddingsCreate.mockReset();
    chatCreate.mockReset();
    turnstileFetch.mockClear();
    vi.stubGlobal("fetch", turnstileFetch);
    configure(Object.keys(FULL_ENV) as ApiEnvName[]);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...env };
  });

  describe("fail-closed: API-Stufe nur mit vollständiger Konfiguration", () => {
    test("GET ohne jede Konfiguration nennt alle sechs fehlenden Variablen, ohne Werte", async () => {
      const off = await (await get()).json();
      expect(off).toMatchObject({ enabled: false, turnstile: false });
      expect(off.missing).toEqual(API_REQUIREMENTS.map((r) => r.env));
      expect(off.missing).toHaveLength(6);
      expect(String(off.reason)).toMatch(/^Auf dem Server fehlt Konfiguration: /);
      for (const r of API_REQUIREMENTS) expect(String(off.reason)).toContain(r.env);
    });

    test("GET mit vollständiger Konfiguration und Beispielset ist aktiv, ohne Beispielset nicht", async () => {
      configure();
      expect(await (await get()).json()).toEqual({ enabled: true, turnstile: true });
      state.labeledEmpty = true;
      const noSet = await (await get()).json();
      expect(noSet).toMatchObject({ enabled: false, turnstile: true });
      expect(String(noSet.reason)).toMatch(/Beispielset/);
    });

    test.each(API_REQUIREMENTS.map((r) => r.env))("fehlt %s: GET meldet enabled:false mit Begründung, POST antwortet 503 ohne OpenAI-Aufruf", async (name) => {
      configure([name]);
      const status = await (await get()).json();
      expect(status.enabled).toBe(false);
      expect(status.missing).toEqual([name]);
      expect(String(status.reason)).toContain(name);
      for (const value of Object.values(FULL_ENV)) expect(JSON.stringify(status)).not.toContain(value);
      const res = await post({ texts: ["REWE SAGT DANKE"] }, { "x-forwarded-for": "8.8.8.8" });
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body).toMatchObject({ disabled: true });
      expect(String(body.reason)).toContain(name);
      for (const value of Object.values(FULL_ENV)) expect(String(body.reason)).not.toContain(value);
      expectNoExternalCalls();
    });

    test("Variable nur aus Leerzeichen zählt als fehlend", async () => {
      configure();
      process.env.TURNSTILE_SECRET_KEY = "   ";
      const status = await (await get()).json();
      expect(status).toMatchObject({ enabled: false, turnstile: false, missing: ["TURNSTILE_SECRET_KEY"] });
      expect((await post({ texts: ["REWE"] })).status).toBe(503);
      expectNoExternalCalls();
    });

    test("IP_HASH_SECRET mit 31 statt mindestens 32 Zeichen zählt als fehlend", async () => {
      configure();
      process.env.IP_HASH_SECRET = "a".repeat(31);
      expect((await (await get()).json()).missing).toEqual(["IP_HASH_SECRET"]);
      expect((await post({ texts: ["REWE"] })).status).toBe(503);
      process.env.IP_HASH_SECRET = "a".repeat(32);
      expect((await (await get()).json()).enabled).toBe(true);
    });

    test("Cloudflare-Testschlüssel in Produktion (NODE_ENV=production ohne Vercel): enabled:false mit eigener Begründung, POST 503", async () => {
      configure();
      (process.env as Record<string, string>).NODE_ENV = "production";
      delete process.env.VERCEL_ENV;
      process.env.TURNSTILE_SECRET_KEY = TURNSTILE_TEST_SECRET_PASS;
      const status = await (await get()).json();
      expect(status).toMatchObject({ enabled: false, turnstile: false, missing: ["TURNSTILE_SECRET_KEY"] });
      expect(String(status.reason)).toBe(
        "In der Produktionsumgebung sind die Cloudflare-Testschlüssel nicht zulässig: geheimer Turnstile-Schlüssel (TURNSTILE_SECRET_KEY).",
      );
      expect(JSON.stringify(status)).not.toContain(TURNSTILE_TEST_SECRET_PASS);
      const res = await post({ texts: ["REWE SAGT DANKE"] });
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ disabled: true });
      expectNoExternalCalls();
    });

    test("Testschlüssel: VERCEL_ENV=production sperrt auch den Websiteschlüssel, Preview und Tests lassen sie zu", async () => {
      configure();
      (process.env as Record<string, string>).NODE_ENV = "production";
      process.env.VERCEL_ENV = "production";
      process.env.TURNSTILE_SECRET_KEY = TURNSTILE_TEST_SECRET_PASS;
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = TURNSTILE_TEST_SITEKEY_PASS;
      const blocked = await (await get()).json();
      expect(blocked).toMatchObject({ enabled: false, turnstile: false, missing: ["TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"] });
      process.env.VERCEL_ENV = "preview";
      expect(await (await get()).json()).toEqual({ enabled: true, turnstile: true });
      delete process.env.VERCEL_ENV;
      (process.env as Record<string, string>).NODE_ENV = "test";
      expect(await (await get()).json()).toEqual({ enabled: true, turnstile: true });
    });

    test("fehlende Variable und Testschlüssel zugleich: beide Begründungen", async () => {
      configure(["OPENAI_API_KEY"]);
      process.env.VERCEL_ENV = "production";
      process.env.TURNSTILE_SECRET_KEY = TURNSTILE_TEST_SECRET_PASS;
      const status = await (await get()).json();
      expect(status.missing).toEqual(["OPENAI_API_KEY", "TURNSTILE_SECRET_KEY"]);
      expect(String(status.reason)).toBe(
        "Auf dem Server fehlt Konfiguration: OpenAI-Schlüssel (OPENAI_API_KEY). In der Produktionsumgebung sind die Cloudflare-Testschlüssel nicht zulässig: geheimer Turnstile-Schlüssel (TURNSTILE_SECRET_KEY).",
      );
    });

    test("ohne Beispielset antwortet POST mit 503 disabled, vor Turnstile und Rate-Limit", async () => {
      configure();
      state.labeledEmpty = true;
      const res = await post({ texts: ["REWE SAGT DANKE"] });
      expect(res.status).toBe(503);
      expect(await res.json()).toMatchObject({ disabled: true });
      expectNoExternalCalls();
    });
  });

  describe("IP-Pseudonymisierung", () => {
    test("an das Rate-Limit geht nur der HMAC der IP; gleiche IP gleicher Schlüssel, andere IP anderer", async () => {
      configure();
      embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1, 0, 0] }] });
      await post({ texts: ["A LADEN"] }, { "x-forwarded-for": "198.51.100.23" });
      await post({ texts: ["B LADEN"] }, { "x-forwarded-for": "198.51.100.23" });
      await post({ texts: ["C LADEN"] }, { "x-forwarded-for": "198.51.100.24" });
      expect(limitCalls).toHaveLength(3);
      expect(limitCalls[0]).toBe(pseudonymizeIp("198.51.100.23", IP_SECRET));
      expect(limitCalls[1]).toBe(limitCalls[0]);
      expect(limitCalls[2]).toBe(pseudonymizeIp("198.51.100.24", IP_SECRET));
      expect(limitCalls[2]).not.toBe(limitCalls[0]);
      for (const id of limitCalls) {
        expect(id).toMatch(/^[0-9a-f]{64}$/);
        expect(id).not.toContain("198.51.100");
      }
      for (const key of redisStore.keys()) expect(key).not.toContain("198.51.100");
    });

    test("IPv6: zwei Adressen im selben /64 teilen sich einen Schlüssel, ein anderes /64 bekommt einen eigenen; Turnstile erhält die volle Adresse", async () => {
      configure();
      embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1, 0, 0] }] });
      await post({ texts: ["A LADEN"] }, { "x-forwarded-for": "2001:db8:abcd:12::1" });
      await post({ texts: ["B LADEN"] }, { "x-forwarded-for": "2001:db8:abcd:12:ffff:ffff:ffff:2" });
      await post({ texts: ["C LADEN"] }, { "x-forwarded-for": "2001:db8:abcd:13::1" });
      expect(limitCalls).toHaveLength(3);
      expect(limitCalls[0]).toBe(pseudonymizeIp("2001:db8:abcd:12::/64", IP_SECRET));
      expect(limitCalls[1]).toBe(limitCalls[0]);
      expect(limitCalls[2]).toBe(pseudonymizeIp("2001:db8:abcd:13::/64", IP_SECRET));
      const remoteIps = turnstileFetch.mock.calls.map((call) => (call[1]?.body as URLSearchParams).get("remoteip"));
      expect(remoteIps).toEqual(["2001:db8:abcd:12::1", "2001:db8:abcd:12:ffff:ffff:ffff:2", "2001:db8:abcd:13::1"]);
    });

    test("ohne gültige Client-IP: 503 vor Turnstile und Rate-Limit, kein gemeinsamer Zähler für „unknown“", async () => {
      configure();
      for (const value of ["", "unknown", "999.1.1.1"]) {
        const res = await post({ texts: ["REWE SAGT DANKE"] }, { "x-forwarded-for": value });
        expect(res.status).toBe(503);
        expect(String((await res.json()).error)).toMatch(/Client-Adresse nicht ermittelbar/);
      }
      expectNoExternalCalls();
    });

    test("Redis wird mit den konfigurierten Upstash-Werten verbunden", async () => {
      configure();
      embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1, 0, 0] }] });
      await post({ texts: ["REWE"] });
      expect(redisOptions).toEqual([{ url: FULL_ENV.UPSTASH_REDIS_REST_URL, token: FULL_ENV.UPSTASH_REDIS_REST_TOKEN }]);
    });
  });

  describe("Body-Limit 200.000 Byte", () => {
    test("content-length über dem Limit: 413, ohne den Body zu lesen", async () => {
      configure();
      const res = await post({ texts: ["REWE"] }, { "content-length": "500000" });
      expect(res.status).toBe(413);
      expectNoExternalCalls();
    });

    test("fehlender content-length-Header: tatsächliche Größe zählt (gestreamt, 200.001 Byte)", async () => {
      configure();
      const prefix = '{"texts":["';
      const suffix = '"]}';
      const filler = "A".repeat(200_001 - prefix.length - suffix.length);
      const res = await postStream([prefix, filler.slice(0, 100_000), filler.slice(100_000), suffix]);
      expect(res.status).toBe(413);
      expectNoExternalCalls();
    });

    test("falscher content-length-Header (100) bei 300.000 Byte Body: 413", async () => {
      configure();
      const res = await post(`{"texts":["${"A".repeat(300_000)}"]}`, { "content-length": "100" });
      expect(res.status).toBe(413);
      expectNoExternalCalls();
    });

    test("das Limit zählt Byte, nicht Zeichen: 100.000 × „ü“ = 200.014 Byte bei 100.014 Zeichen", async () => {
      configure();
      const body = `{"texts":["${"ü".repeat(100_000)}"]}`;
      expect(body.length).toBe(100_014);
      expect(new TextEncoder().encode(body).byteLength).toBe(200_014);
      const res = await post(body);
      expect(res.status).toBe(413);
    });

    test("genau 200.000 Byte werden noch gelesen", async () => {
      configure();
      const prefix = '{"texts":[],"pad":"';
      const suffix = '"}';
      const body = prefix + "A".repeat(200_000 - prefix.length - suffix.length) + suffix;
      expect(new TextEncoder().encode(body).byteLength).toBe(200_000);
      const res = await postStream([body]);
      expect(res.status).toBe(200);
    });
  });

  describe("Ablauf mit vollständiger Konfiguration", () => {
    test("ungültige Eingaben", async () => {
      configure();
      expect((await post("{nicht json")).status).toBe(400);
      expect((await post("null")).status).toBe(400);
      expect((await post("[1,2]")).status).toBe(400);
      expect((await post({ texts: "x" })).status).toBe(400);
      expect((await post({ texts: new Array(501).fill("A") })).status).toBe(400);
      expect((await post({ texts: [] })).status).toBe(200);
      expectNoExternalCalls();
    });

    test("Embedding-Batch, kNN, Cache-Schreiben; zweiter Aufruf nur aus dem Cache", async () => {
      configure();
      embeddingsCreate.mockResolvedValue({
        data: [
          { index: 1, embedding: [0, 0.02, 0.98] },
          { index: 0, embedding: [0.98, 0.02, 0] },
        ],
      });
      const first = await post({ texts: ["REWE SAGT DANKE", "Netflix International B.V."] }, { "x-forwarded-for": "8.8.8.8" });
      expect(first.status).toBe(200);
      const body = (await first.json()) as { results: { text: string; category: string; source: string }[]; stats: { cached: number; embedded: number } };
      expect(body.results.map((r) => [r.text, r.category, r.source])).toEqual([
        ["REWE SAGT DANKE", "Lebensmittel", "knn"],
        ["NETFLIX INTERNATIONAL", "Abos & Medien", "knn"],
      ]);
      expect(embeddingsCreate).toHaveBeenCalledTimes(1);
      expect(embeddingsCreate.mock.calls[0]?.[0]).toMatchObject({ input: ["REWE SAGT DANKE", "NETFLIX INTERNATIONAL"] });
      expect(chatCreate).not.toHaveBeenCalled();
      expect(redisStore.size).toBe(2);

      const second = await post({ texts: ["REWE SAGT DANKE"] }, { "x-forwarded-for": "8.8.8.8" });
      const body2 = (await second.json()) as { results: { source: string }[]; stats: { cached: number; embedded: number } };
      expect(body2.results[0]?.source).toBe("cache");
      expect(body2.stats).toMatchObject({ cached: 1, embedded: 0 });
      expect(embeddingsCreate).toHaveBeenCalledTimes(1);
    });

    test("Rate-Limit greift beim dritten Aufruf derselben IP", async () => {
      configure();
      embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1, 0, 0] }] });
      await post({ texts: ["A LADEN"] }, { "x-forwarded-for": "1.1.1.1" });
      await post({ texts: ["B LADEN"] }, { "x-forwarded-for": "1.1.1.1" });
      const third = await post({ texts: ["C LADEN"] }, { "x-forwarded-for": "1.1.1.1" });
      expect(third.status).toBe(429);
      expect(third.headers.get("retry-after")).toBeTruthy();
      expect(embeddingsCreate).toHaveBeenCalledTimes(2);
    });

    test("server messages leave the rule-engine sentence to the UI, so it never appears twice", async () => {
      configure();
      embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1, 0, 0] }] });
      await post({ texts: ["A LADEN"] }, { "x-forwarded-for": "2.2.2.2" });
      await post({ texts: ["B LADEN"] }, { "x-forwarded-for": "2.2.2.2" });
      const limited = (await (await post({ texts: ["C LADEN"] }, { "x-forwarded-for": "2.2.2.2" })).json()) as { error: string };
      expect(limited.error).toBe("Tageslimit erreicht.");
      expect(apiErrorText(limited.error)).toBe("Tageslimit erreicht. Die Regel-Engine bleibt aktiv.");
      const noIp = (await (await post({ texts: ["REWE"] }, { "x-forwarded-for": "" })).json()) as { error: string };
      expect(apiErrorText(noIp.error)).toBe("Client-Adresse nicht ermittelbar, das Rate-Limit ist nicht anwendbar. Die Regel-Engine bleibt aktiv.");
      configure(["OPENAI_API_KEY"]);
      const off = (await (await post({ texts: ["REWE"] })).json()) as { reason: string };
      expect(off.reason).not.toContain("Regel-Engine");
      expect(apiErrorText("Bot-Prüfung fehlgeschlagen")).toBe("Bot-Prüfung fehlgeschlagen. Die Regel-Engine bleibt aktiv.");
      expect(apiErrorText("Fehler 500. Die Regel-Engine bleibt aktiv.")).toBe("Fehler 500. Die Regel-Engine bleibt aktiv.");
    });

    test("Rate-Limit nicht erreichbar: fail-closed mit 503, kein OpenAI-Aufruf", async () => {
      configure();
      state.limiterDown = true;
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await post({ texts: ["REWE SAGT DANKE"] });
      expect(res.status).toBe(503);
      expect(embeddingsCreate).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    test("Rate-Limit antwortet nicht (Timeout der Bibliothek): 503 statt Durchlassen, kein OpenAI-Aufruf", async () => {
      configure();
      state.limiterHangs = true;
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await post({ texts: ["REWE SAGT DANKE"] });
      expect(res.status).toBe(503);
      expect(String((await res.json()).error)).toMatch(/Rate-Limit nicht erreichbar/);
      expect(state.hangCalls).toBe(1);
      expect(embeddingsCreate).not.toHaveBeenCalled();
      expect(chatCreate).not.toHaveBeenCalled();
      expect(redisStore.size).toBe(0);
      spy.mockRestore();
    });

    test("Turnstile: ohne Token 403, mit falschem Token 403, jeweils ohne OpenAI-Aufruf und ohne Rate-Limit-Zählung", async () => {
      configure();
      const missing = await post({ texts: ["REWE"], turnstileToken: undefined });
      expect(missing.status).toBe(403);
      expect(turnstileFetch).not.toHaveBeenCalled();
      const wrong = await post({ texts: ["REWE"], turnstileToken: "falsch" });
      expect(wrong.status).toBe(403);
      expect(turnstileFetch).toHaveBeenCalledTimes(1);
      expect(embeddingsCreate).not.toHaveBeenCalled();
      expect(limitCalls).toHaveLength(0);
    });

    test("Turnstile nicht erreichbar: 502 ohne OpenAI-Aufruf", async () => {
      configure();
      turnstileFetch.mockRejectedValueOnce(new Error("offline"));
      const res = await post({ texts: ["REWE"] });
      expect(res.status).toBe(502);
      expect(embeddingsCreate).not.toHaveBeenCalled();
    });

    test("Fallback-Modell wird nur für Konfidenz unter 0,5 aufgerufen und liefert JSON", async () => {
      configure();
      embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [0.5, 0.5, 0.5] }] });
      chatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ items: [{ i: 0, c: "Gesundheit" }] }) } }] });
      const res = await post({ texts: ["Praxis Dr. Unbekannt"] });
      const body = (await res.json()) as { results: { category: string; source: string; confidence: number }[]; stats: { fallback: number } };
      expect(body.results[0]).toMatchObject({ category: "Gesundheit", source: "llm", confidence: 0.5 });
      expect(body.stats.fallback).toBe(1);
      expect(chatCreate).toHaveBeenCalledTimes(1);
      const userMessage = String((chatCreate.mock.calls[0]?.[0] as { messages: { content: string }[] }).messages[1]?.content);
      expect(userMessage).toContain("PRAXIS DR UNBEKANNT");
      expect(userMessage).not.toMatch(/\d{2}\.\d{2}\.\d{4}/);
    });

    test("OpenAI-Fehler liefert 502 ohne Buchungstexte im Log", async () => {
      configure();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      embeddingsCreate.mockRejectedValue(Object.assign(new Error("boom REWE"), { status: 500 }));
      const res = await post({ texts: ["REWE SAGT DANKE"] });
      expect(res.status).toBe(502);
      const logged = spy.mock.calls.flat().map(String).join(" ");
      expect(logged).not.toContain("REWE");
      spy.mockRestore();
    });
  });
});
