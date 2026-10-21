import { isCategory, type Category } from "./categories";
import type { LabeledVector } from "./knn";
import { normalizeMerchant } from "./merchant";
import type { EmbedFn } from "./server";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_PRICE_USD_PER_MILLION_TOKENS = 0.02;
export const EMBEDDING_BATCH_SIZE = 200;
export const VECTOR_DECIMALS = 5;

const PERSONAL_DATA_PATTERNS: readonly RegExp[] = [/\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/i, /[^\s@]+@[^\s@]+\.[a-z]{2,}/i, /\d{5,}/];

export interface PreparedExamples {
  items: { text: string; category: Category }[];
  skipped: number;
  conflicts: string[];
}

export function prepareExamples(examples: readonly { text: string; category: string }[]): PreparedExamples {
  const unique = new Map<string, Category>();
  const conflicts = new Set<string>();
  let skipped = 0;
  examples.forEach((example, index) => {
    if (PERSONAL_DATA_PATTERNS.some((pattern) => pattern.test(example.text))) throw new Error(`Beispieltext ${index} sieht nach Konto- oder Kontaktdaten aus und gehört nicht ins Beispielset`);
  });
  for (const example of examples) {
    const text = normalizeMerchant(example.text);
    if (text === "" || !isCategory(example.category)) {
      skipped++;
      continue;
    }
    const known = unique.get(text);
    if (known !== undefined && known !== example.category) conflicts.add(text);
    unique.set(text, example.category);
  }
  return { items: [...unique.entries()].map(([text, category]) => ({ text, category })), skipped, conflicts: [...conflicts] };
}

export function estimateTokens(texts: readonly string[]): number {
  return texts.reduce((sum, text) => sum + Math.ceil(text.length / 3), 0);
}

export function estimateCostUsd(tokens: number, pricePerMillion = EMBEDDING_PRICE_USD_PER_MILLION_TOKENS): number {
  return (tokens / 1_000_000) * pricePerMillion;
}

function roundVector(vector: readonly number[]): number[] {
  const factor = 10 ** VECTOR_DECIMALS;
  return vector.map((x) => Math.round(x * factor) / factor);
}

export async function embedExamples(
  items: readonly { text: string; category: Category }[],
  embed: EmbedFn,
  options: { batchSize?: number; onBatch?: (done: number, total: number) => void } = {},
): Promise<LabeledVector[]> {
  const batchSize = options.batchSize ?? EMBEDDING_BATCH_SIZE;
  const out: LabeledVector[] = [];
  let dimension: number | null = null;
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const vectors = await embed(batch.map((item) => item.text));
    if (vectors.length !== batch.length) throw new Error(`Embedding-Antwort mit ${vectors.length} statt ${batch.length} Vektoren`);
    batch.forEach((item, j) => {
      const vector = vectors[j]!;
      dimension ??= vector.length;
      if (vector.length === 0 || vector.length !== dimension) throw new Error(`Vektor für Eintrag ${i + j} hat ${vector.length} statt ${dimension} Dimensionen`);
      out.push({ text: item.text, category: item.category, vector: roundVector(vector) });
    });
    options.onBatch?.(Math.min(i + batchSize, items.length), items.length);
  }
  return out;
}

export interface LabeledEmbeddingsFile {
  model: string;
  createdAt: string;
  count: number;
  items: LabeledVector[];
}

export function labeledEmbeddingsFile(model: string, createdAt: string, items: LabeledVector[]): LabeledEmbeddingsFile {
  return { model, createdAt, count: items.length, items: items.map(({ text, category, vector }) => ({ text, category, vector })) };
}
