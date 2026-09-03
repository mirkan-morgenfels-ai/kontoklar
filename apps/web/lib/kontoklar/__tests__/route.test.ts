import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const embeddingsCreate = vi.fn();
const chatCreate = vi.fn();
const redisStore = new Map<string, string>();
const limitCalls: string[] = [];

vi.mock("openai", () => ({
  default: class {
    embeddings = { create: embeddingsCreate };
    chat = { completions: { create: chatCreate } };
  },
}));

vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      mget: async (...keys: string[]) => keys.map((k) => redisStore.get(k) ?? null),
      pipeline: () => {
        const ops: [string, string][] = [];
        return {
          set: (k: string, v: string) => ops.push([k, v]),
          exec: async () => {
            for (const [k, v] of ops) redisStore.set(k, v);
          },
        };
      },
    }),
  },
}));

vi.mock("@portfolio/ratelimit", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@portfolio/ratelimit")>();
  return {
    ...mod,
    createRateLimiter: () => ({
      async limit(id: string) {
        limitCalls.push(id);
        const success = limitCalls.filter((x) => x === id).length <= 2;
        return { success, limit: 2, remaining: 0, reset: Date.now() + 1000 };
      },
    }),
  };
});

vi.mock("../providers", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../providers")>();
  return {
    ...mod,
    loadLabeledVectors: async () => [
      { text: "REWE", category: "Lebensmittel", vector: [1, 0, 0] },
      { text: "DM", category: "Drogerie & Haushalt", vector: [0, 1, 0] },
      { text: "NETFLIX", category: "Abos & Medien", vector: [0, 0, 1] },
    ],
  };
});

async function post(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import("../../../app/api/categorize/route");
  const req = new Request("http://localhost/api/categorize", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return POST(req);
}

describe("POST /api/categorize", () => {
  const env = { ...process.env };
  beforeEach(() => {
    redisStore.clear();
    limitCalls.length = 0;
    embeddingsCreate.mockReset();
    chatCreate.mockReset();
    delete process.env.OPENAI_API_KEY;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.TURNSTILE_SECRET_KEY;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  test("ohne OPENAI_API_KEY antwortet die Route mit 503 disabled", async () => {
    const res = await post({ texts: ["REWE SAGT DANKE"] });
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ disabled: true });
    expect(embeddingsCreate).not.toHaveBeenCalled();
  });

  test("ungültige Eingaben", async () => {
    process.env.OPENAI_API_KEY = "test";
    expect((await post("{nicht json")).status).toBe(400);
    expect((await post({ texts: "x" })).status).toBe(400);
    expect((await post({ texts: new Array(501).fill("A") })).status).toBe(400);
    expect((await post({ texts: [] })).status).toBe(200);
  });

  test("Embedding-Batch, kNN, Cache-Schreiben; zweiter Aufruf nur aus dem Cache", async () => {
    process.env.OPENAI_API_KEY = "test";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
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
    process.env.OPENAI_API_KEY = "test";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    embeddingsCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1, 0, 0] }] });
    await post({ texts: ["A LADEN"] }, { "x-forwarded-for": "1.1.1.1" });
    await post({ texts: ["B LADEN"] }, { "x-forwarded-for": "1.1.1.1" });
    const third = await post({ texts: ["C LADEN"] }, { "x-forwarded-for": "1.1.1.1" });
    expect(third.status).toBe(429);
    expect(third.headers.get("retry-after")).toBeTruthy();
  });

  test("Turnstile: mit Secret aber ohne Token 403", async () => {
    process.env.OPENAI_API_KEY = "test";
    process.env.TURNSTILE_SECRET_KEY = "secret";
    const res = await post({ texts: ["REWE"] });
    expect(res.status).toBe(403);
    expect(embeddingsCreate).not.toHaveBeenCalled();
  });

  test("Fallback-Modell wird nur für Konfidenz unter 0,5 aufgerufen und liefert JSON", async () => {
    process.env.OPENAI_API_KEY = "test";
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
    process.env.OPENAI_API_KEY = "test";
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    embeddingsCreate.mockRejectedValue(Object.assign(new Error("boom REWE"), { status: 500 }));
    const res = await post({ texts: ["REWE SAGT DANKE"] });
    expect(res.status).toBe(502);
    const logged = spy.mock.calls.flat().map(String).join(" ");
    expect(logged).not.toContain("REWE");
    spy.mockRestore();
  });
});
