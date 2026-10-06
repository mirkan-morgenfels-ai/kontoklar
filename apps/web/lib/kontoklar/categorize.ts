import type { Transaction } from "@portfolio/csv";
import type { Category } from "./categories";
import { isApiEligible, merchantKeyFor } from "./merchant";
import { defaultRuleEngine, type RuleEngine } from "./rules";
import {
  MAX_TEXTS_PER_CALL,
  THRESHOLDS,
  type ApiCategorizeItem,
  type ApiCategorizeResponse,
  type ApiDisabledResponse,
  type ApiStatusResponse,
  type CategorizedTransaction,
  type Categorization,
} from "./types";

export function applyRules(transactions: Transaction[], engine: RuleEngine = defaultRuleEngine()): CategorizedTransaction[] {
  return transactions.map((tx) => {
    const merchantKey = merchantKeyFor(tx);
    const apiEligible = isApiEligible(tx);
    const hit = engine.match(tx, merchantKey);
    let categorization: Categorization;
    if (hit) {
      categorization = { category: hit.category, confidence: 1, source: "rule", needsReview: false, ruleId: hit.ruleId };
    } else if (tx.amount > 0) {
      categorization = { category: "Einkommen", confidence: 0.6, source: "none", needsReview: true };
    } else {
      categorization = { category: "Sonstiges", confidence: 0, source: "none", needsReview: true };
    }
    return { ...tx, merchantKey, apiEligible, categorization };
  });
}

export function collectApiCandidates(items: CategorizedTransaction[]): string[] {
  const seen = new Set<string>();
  for (const it of items) {
    if (it.categorization.source !== "none") continue;
    if (!it.apiEligible) continue;
    if (it.merchantKey === "") continue;
    seen.add(it.merchantKey);
  }
  return [...seen];
}

export function collectApiTexts(items: CategorizedTransaction[]): string[] {
  return collectApiCandidates(items).slice(0, MAX_TEXTS_PER_CALL);
}

export function categorizationFromApi(item: ApiCategorizeItem): Categorization {
  const needsReview = item.confidence < THRESHOLDS.accept;
  return { category: item.category, confidence: item.confidence, source: item.source, needsReview };
}

export function mergeApiResults(items: CategorizedTransaction[], results: ApiCategorizeItem[]): CategorizedTransaction[] {
  const byText = new Map(results.map((r) => [r.text, r]));
  return items.map((it) => {
    if (it.categorization.source !== "none") return it;
    const hit = byText.get(it.merchantKey);
    if (!hit) return it;
    return { ...it, categorization: categorizationFromApi(hit) };
  });
}

export function setManualCategory(items: CategorizedTransaction[], id: string, category: Category): CategorizedTransaction[] {
  return items.map((it) => (it.id === id ? { ...it, categorization: { category, confidence: 1, source: "manual", needsReview: false } } : it));
}

export function applyManualToSameMerchant(items: CategorizedTransaction[], merchantKey: string, category: Category): CategorizedTransaction[] {
  if (merchantKey === "") return items;
  return items.map((it) =>
    it.merchantKey === merchantKey && it.categorization.source !== "rule"
      ? { ...it, categorization: { category, confidence: 1, source: "manual", needsReview: false } }
      : it,
  );
}

export interface ApiCallResult {
  ok: boolean;
  disabled?: boolean;
  status?: number;
  message?: string;
  response?: ApiCategorizeResponse;
}

export async function callCategorizeApi(texts: string[], turnstileToken?: string, fetchImpl: typeof fetch = fetch): Promise<ApiCallResult> {
  if (texts.length === 0) return { ok: true, response: { results: [], stats: { cached: 0, embedded: 0, fallback: 0 } } };
  const res = await fetchImpl("/api/categorize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts, turnstileToken }),
  });
  const data = (await res.json().catch(() => null)) as ApiCategorizeResponse | ApiDisabledResponse | { error?: string } | null;
  if (res.status === 503 && data && "disabled" in data) {
    return { ok: false, disabled: true, status: 503, message: data.reason };
  }
  if (!res.ok || !data || !("results" in data)) {
    const message = data && "error" in data && data.error ? data.error : `Fehler ${res.status}`;
    return { ok: false, status: res.status, message };
  }
  return { ok: true, response: data };
}

export async function fetchApiStatus(fetchImpl: typeof fetch = fetch): Promise<ApiStatusResponse> {
  try {
    const res = await fetchImpl("/api/categorize", { method: "GET", cache: "no-store" });
    if (!res.ok) return { enabled: false, turnstile: false, reason: "Der Server hat nicht geantwortet." };
    const data = (await res.json()) as Partial<ApiStatusResponse>;
    const missing = Array.isArray(data.missing) ? data.missing.filter((m): m is string => typeof m === "string") : undefined;
    return { enabled: data.enabled === true, turnstile: data.turnstile === true, reason: data.reason, missing };
  } catch {
    return { enabled: false, turnstile: false, reason: "Der Server ist nicht erreichbar." };
  }
}

export interface Summary {
  total: number;
  byRule: number;
  byCache: number;
  byKnn: number;
  byLlm: number;
  manual: number;
  uncategorized: number;
  needsReview: number;
}

export function summarize(items: CategorizedTransaction[]): Summary {
  const s: Summary = { total: items.length, byRule: 0, byCache: 0, byKnn: 0, byLlm: 0, manual: 0, uncategorized: 0, needsReview: 0 };
  for (const it of items) {
    switch (it.categorization.source) {
      case "rule":
        s.byRule++;
        break;
      case "cache":
        s.byCache++;
        break;
      case "knn":
        s.byKnn++;
        break;
      case "llm":
        s.byLlm++;
        break;
      case "manual":
        s.manual++;
        break;
      default:
        s.uncategorized++;
    }
    if (it.categorization.needsReview) s.needsReview++;
  }
  return s;
}
