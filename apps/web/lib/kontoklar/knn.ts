import type { Category } from "./categories";

export interface LabeledVector {
  text: string;
  category: Category;
  vector: number[];
}

export interface Neighbor {
  category: Category;
  similarity: number;
  text?: string;
}

export interface KnnVote {
  category: Category | null;
  confidence: number;
  neighbors: Neighbor[];
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) throw new Error("Vektoren müssen gleiche, positive Länge haben");
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function nearestNeighbors(query: readonly number[], labeled: readonly LabeledVector[], k = 3): Neighbor[] {
  const scored: Neighbor[] = labeled.map((l) => ({ category: l.category, similarity: cosineSimilarity(query, l.vector), text: l.text }));
  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, k);
}

export function voteKnn(neighbors: readonly Neighbor[]): KnnVote {
  if (neighbors.length === 0) return { category: null, confidence: 0, neighbors: [] };
  const weight = new Map<Category, { sum: number; count: number }>();
  let total = 0;
  for (const n of neighbors) {
    const sim = Math.max(n.similarity, 0);
    total += sim;
    const entry = weight.get(n.category) ?? { sum: 0, count: 0 };
    entry.sum += sim;
    entry.count += 1;
    weight.set(n.category, entry);
  }
  let best: Category | null = null;
  let bestEntry = { sum: -1, count: 0 };
  for (const [cat, entry] of weight) {
    if (entry.sum > bestEntry.sum) {
      best = cat;
      bestEntry = entry;
    }
  }
  if (best === null || total === 0) return { category: null, confidence: 0, neighbors: [...neighbors] };
  const meanSimilarity = bestEntry.sum / bestEntry.count;
  const share = bestEntry.sum / total;
  const hasMajority = bestEntry.count * 2 > neighbors.length;
  const confidence = hasMajority ? meanSimilarity : meanSimilarity * share;
  return { category: best, confidence: Math.max(0, Math.min(1, confidence)), neighbors: [...neighbors] };
}

export function classifyByKnn(query: readonly number[], labeled: readonly LabeledVector[], k = 3): KnnVote {
  return voteKnn(nearestNeighbors(query, labeled, k));
}
