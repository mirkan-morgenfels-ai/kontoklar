import { CATEGORIES, isCategory, type Category } from "./categories";
import { classifyByKnn, type LabeledVector } from "./knn";
import { normalizeMerchant } from "./merchant";
import { CACHE_TTL_SECONDS, MAX_TEXTS_PER_CALL, MAX_TEXT_LENGTH, THRESHOLDS, type ApiCategorizeItem, type ApiCategorizeResponse } from "./types";

export interface CategoryCache {
  mget(keys: string[]): Promise<(string | null)[]>;
  mset(entries: [string, string][], ttlSeconds: number): Promise<void>;
}

export type EmbedFn = (texts: string[]) => Promise<number[][]>;
export type FallbackFn = (texts: string[], categories: readonly string[]) => Promise<Record<string, string>>;

export interface CategorizeDeps {
  cache: CategoryCache | null;
  embed: EmbedFn | null;
  labeled: LabeledVector[];
  fallback: FallbackFn | null;
  k?: number;
}

interface CachedValue {
  c: string;
  p: number;
}

export const CACHE_PREFIX = "kk:cat:v1:";

export function cacheKey(text: string): string {
  return CACHE_PREFIX + text;
}

export function sanitizeTexts(input: unknown): { texts: string[]; error?: string } {
  if (!Array.isArray(input)) return { texts: [], error: "texts muss ein Array sein" };
  if (input.length > MAX_TEXTS_PER_CALL) return { texts: [], error: `höchstens ${MAX_TEXTS_PER_CALL} Texte pro Aufruf` };
  const seen = new Set<string>();
  for (const raw of input) {
    if (typeof raw !== "string") return { texts: [], error: "texts darf nur Strings enthalten" };
    const normalized = normalizeMerchant(raw).slice(0, MAX_TEXT_LENGTH);
    if (normalized === "") continue;
    seen.add(normalized);
  }
  return { texts: [...seen] };
}

function parseCached(value: string | null): CachedValue | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<CachedValue>;
    if (typeof parsed.c === "string" && isCategory(parsed.c) && typeof parsed.p === "number") return { c: parsed.c, p: parsed.p };
  } catch {
    if (isCategory(value)) return { c: value, p: 1 };
  }
  return null;
}

export async function categorizeTexts(texts: string[], deps: CategorizeDeps): Promise<ApiCategorizeResponse> {
  const results = new Map<string, ApiCategorizeItem>();
  const stats = { cached: 0, embedded: 0, fallback: 0 };
  let pending = [...texts];

  if (deps.cache && pending.length > 0) {
    const values = await deps.cache.mget(pending.map(cacheKey));
    const stillPending: string[] = [];
    pending.forEach((text, i) => {
      const hit = parseCached(values[i] ?? null);
      if (hit) {
        results.set(text, { text, category: hit.c as Category, confidence: hit.p, source: "cache" });
        stats.cached++;
      } else {
        stillPending.push(text);
      }
    });
    pending = stillPending;
  }

  const toCache: [string, string][] = [];
  const lowConfidence: string[] = [];

  if (deps.embed && deps.labeled.length > 0 && pending.length > 0) {
    const vectors = await deps.embed(pending);
    pending.forEach((text, i) => {
      const vector = vectors[i];
      if (!vector) return;
      const vote = classifyByKnn(vector, deps.labeled, deps.k ?? 3);
      stats.embedded++;
      if (vote.category && vote.confidence >= THRESHOLDS.review) {
        results.set(text, { text, category: vote.category, confidence: round3(vote.confidence), source: "knn" });
        toCache.push([cacheKey(text), JSON.stringify({ c: vote.category, p: round3(vote.confidence) })]);
      } else {
        lowConfidence.push(text);
        if (vote.category) {
          results.set(text, { text, category: vote.category, confidence: round3(vote.confidence), source: "knn" });
        }
      }
    });
    pending = [];
  }

  const fallbackCandidates = lowConfidence.length > 0 ? lowConfidence : pending;
  if (deps.fallback && fallbackCandidates.length > 0) {
    const decided = await deps.fallback(fallbackCandidates, CATEGORIES);
    for (const text of fallbackCandidates) {
      const cat = decided[text];
      if (cat && isCategory(cat)) {
        stats.fallback++;
        results.set(text, { text, category: cat, confidence: THRESHOLDS.review, source: "llm" });
        toCache.push([cacheKey(text), JSON.stringify({ c: cat, p: THRESHOLDS.review })]);
      }
    }
  }

  if (deps.cache && toCache.length > 0) {
    await deps.cache.mset(toCache, CACHE_TTL_SECONDS);
  }

  return { results: texts.filter((t) => results.has(t)).map((t) => results.get(t)!), stats };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
