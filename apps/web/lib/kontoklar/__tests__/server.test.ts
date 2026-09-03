import { describe, expect, test, vi } from "vitest";
import type { LabeledVector } from "../knn";
import { cacheKey, categorizeTexts, sanitizeTexts, type CategoryCache } from "../server";

function memoryCache(initial: Record<string, string> = {}): CategoryCache & { store: Map<string, string>; ttls: number[] } {
  const store = new Map(Object.entries(initial));
  const ttls: number[] = [];
  return {
    store,
    ttls,
    async mget(keys) {
      return keys.map((k) => store.get(k) ?? null);
    },
    async mset(entries, ttl) {
      for (const [k, v] of entries) store.set(k, v);
      ttls.push(ttl);
    },
  };
}

const labeled: LabeledVector[] = [
  { text: "REWE", category: "Lebensmittel", vector: [1, 0, 0] },
  { text: "DM", category: "Drogerie & Haushalt", vector: [0, 1, 0] },
  { text: "NETFLIX", category: "Abos & Medien", vector: [0, 0, 1] },
  { text: "EDEKA", category: "Lebensmittel", vector: [0.9, -0.1, -0.1] },
  { text: "SPOTIFY", category: "Abos & Medien", vector: [-0.1, -0.1, 0.9] },
];

const vectorFor: Record<string, number[]> = {
  "REWE SAGT DANKE": [0.98, 0.02, 0],
  "NETFLIX INTERNATIONAL": [0, 0.02, 0.98],
  "FRANZ HUBER SCHREINEREI": [1, 1, 1],
};

describe("sanitizeTexts", () => {
  test("normalisiert, dedupliziert und begrenzt", () => {
    expect(sanitizeTexts(["REWE SAGT DANKE", "rewe sagt danke 12345", "", "   "])).toEqual({ texts: ["REWE SAGT DANKE"] });
    expect(sanitizeTexts("x").error).toMatch(/Array/);
    expect(sanitizeTexts([1]).error).toMatch(/Strings/);
    expect(sanitizeTexts(new Array(501).fill("A")).error).toMatch(/500/);
  });
});

describe("categorizeTexts: Reihenfolge Cache -> Embedding -> Fallback", () => {
  test("Cache-Treffer erzeugen keinen Embedding-Aufruf", async () => {
    const cache = memoryCache({ [cacheKey("REWE SAGT DANKE")]: JSON.stringify({ c: "Lebensmittel", p: 0.91 }) });
    const embed = vi.fn(async () => []);
    const fallback = vi.fn(async () => ({}));
    const res = await categorizeTexts(["REWE SAGT DANKE"], { cache, embed, labeled, fallback });
    expect(res.results).toEqual([{ text: "REWE SAGT DANKE", category: "Lebensmittel", confidence: 0.91, source: "cache" }]);
    expect(res.stats).toEqual({ cached: 1, embedded: 0, fallback: 0 });
    expect(embed).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  test("neue Texte werden in einem Batch eingebettet, per kNN entschieden und gecacht", async () => {
    const cache = memoryCache();
    const embed = vi.fn(async (texts: string[]) => texts.map((t) => vectorFor[t] ?? [0, 0, 0]));
    const fallback = vi.fn(async () => ({}));
    const res = await categorizeTexts(["REWE SAGT DANKE", "NETFLIX INTERNATIONAL"], { cache, embed, labeled, fallback });
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed.mock.calls[0]?.[0]).toEqual(["REWE SAGT DANKE", "NETFLIX INTERNATIONAL"]);
    expect(res.results.map((r) => [r.category, r.source])).toEqual([
      ["Lebensmittel", "knn"],
      ["Abos & Medien", "knn"],
    ]);
    expect(res.results[0]?.confidence).toBeGreaterThanOrEqual(0.8);
    expect(cache.store.size).toBe(2);
    expect(cache.ttls[0]).toBe(60 * 60 * 24 * 30);
    expect(fallback).not.toHaveBeenCalled();
  });

  test("Konfidenz unter 0,5 geht an den Fallback, Ergebnis wird gecacht", async () => {
    const cache = memoryCache();
    const embed = vi.fn(async (texts: string[]) => texts.map((t) => vectorFor[t] ?? [0, 0, 0]));
    const fallback = vi.fn(async (texts: string[]) => Object.fromEntries(texts.map((t) => [t, "Drogerie & Haushalt"])));
    const res = await categorizeTexts(["FRANZ HUBER SCHREINEREI"], { cache, embed, labeled, fallback });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(fallback.mock.calls[0]?.[0]).toEqual(["FRANZ HUBER SCHREINEREI"]);
    expect(res.results[0]).toMatchObject({ category: "Drogerie & Haushalt", source: "llm", confidence: 0.5 });
    expect(res.stats.fallback).toBe(1);
    expect(cache.store.get(cacheKey("FRANZ HUBER SCHREINEREI"))).toContain("Drogerie");
  });

  test("ohne Fallback bleibt das unsichere kNN-Ergebnis erhalten und wird nicht gecacht", async () => {
    const cache = memoryCache();
    const embed = vi.fn(async (texts: string[]) => texts.map((t) => vectorFor[t] ?? [0, 0, 0]));
    const res = await categorizeTexts(["FRANZ HUBER SCHREINEREI"], { cache, embed, labeled, fallback: null });
    expect(res.results[0]?.source).toBe("knn");
    expect(res.results[0]?.confidence).toBeLessThan(0.5);
    expect(cache.store.size).toBe(0);
  });

  test("Ungültige Fallback-Antworten werden ignoriert", async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map(() => [0, 0, 0]));
    const fallback = vi.fn(async () => ({ "FRANZ HUBER SCHREINEREI": "Quatsch" }));
    const res = await categorizeTexts(["FRANZ HUBER SCHREINEREI"], { cache: null, embed, labeled, fallback });
    expect(res.results).toHaveLength(0);
    expect(res.stats.fallback).toBe(0);
  });

  test("ohne Cache und ohne Embeddings entscheidet der Fallback allein", async () => {
    const fallback = vi.fn(async (texts: string[]) => Object.fromEntries(texts.map((t) => [t, "Mobilität"])));
    const res = await categorizeTexts(["TAXI MUENCHEN"], { cache: null, embed: null, labeled: [], fallback });
    expect(res.results[0]).toMatchObject({ category: "Mobilität", source: "llm" });
  });
});
