import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { Redis } from "@upstash/redis";
import { isCategory } from "./categories";
import type { LabeledVector } from "./knn";
import type { CategoryCache, EmbedFn, FallbackFn } from "./server";

export function createRedisCache(redis: Redis): CategoryCache {
  return {
    async mget(keys) {
      if (keys.length === 0) return [];
      const values = await redis.mget<(string | null)[]>(...keys);
      return values.map((v) => (typeof v === "string" ? v : v === null ? null : JSON.stringify(v)));
    },
    async mset(entries, ttlSeconds) {
      const pipeline = redis.pipeline();
      for (const [key, value] of entries) pipeline.set(key, value, { ex: ttlSeconds });
      await pipeline.exec();
    },
  };
}

export function createOpenAiEmbed(client: OpenAI, model = process.env.KONTOKLAR_EMBEDDING_MODEL ?? "text-embedding-3-small"): EmbedFn {
  return async (texts) => {
    const res = await client.embeddings.create({ model, input: texts });
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    return sorted.map((d) => d.embedding);
  };
}

export function createOpenAiFallback(client: OpenAI, model = process.env.KONTOKLAR_FALLBACK_MODEL ?? "gpt-5-nano"): FallbackFn {
  return async (texts, categories) => {
    const system = [
      "Du ordnest normalisierte Händlernamen deutscher Kontoumsätze genau einer Kategorie zu.",
      `Erlaubte Kategorien: ${categories.join(" | ")}.`,
      "Antworte ausschließlich mit JSON der Form {\"items\":[{\"i\":0,\"c\":\"Kategorie\"}]}. Unbekannt: \"Sonstiges\".",
    ].join(" ");
    const user = JSON.stringify(texts.map((t, i) => ({ i, t })));
    const res = await client.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = res.choices[0]?.message?.content ?? "{}";
    const out: Record<string, string> = {};
    try {
      const parsed = JSON.parse(content) as { items?: { i?: number; c?: string }[] };
      for (const item of parsed.items ?? []) {
        if (typeof item.i !== "number" || typeof item.c !== "string") continue;
        const text = texts[item.i];
        if (text && isCategory(item.c)) out[text] = item.c;
      }
    } catch {
      return out;
    }
    return out;
  };
}

let labeledCache: LabeledVector[] | null = null;

export async function loadLabeledVectors(): Promise<LabeledVector[]> {
  if (labeledCache) return labeledCache;
  const candidates = [
    path.join(process.cwd(), "data", "k2", "labeled-embeddings.json"),
    path.join(process.cwd(), "..", "..", "data", "k2", "labeled-embeddings.json"),
  ];
  for (const file of candidates) {
    try {
      const raw = await readFile(file, "utf-8");
      const parsed = JSON.parse(raw) as { items?: LabeledVector[] };
      const items = (parsed.items ?? []).filter((it) => isCategory(it.category) && Array.isArray(it.vector) && it.vector.length > 0);
      labeledCache = items;
      return items;
    } catch {
      continue;
    }
  }
  labeledCache = [];
  return labeledCache;
}

export function openAiClient(apiKey: string | undefined = process.env.OPENAI_API_KEY): OpenAI | null {
  if (!apiKey) return null;
  return new OpenAI({ apiKey, maxRetries: 1, timeout: 20_000 });
}
