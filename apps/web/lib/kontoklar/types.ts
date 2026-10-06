import type { Transaction } from "@portfolio/csv";
import type { Category } from "./categories";

export type CategorySource = "rule" | "cache" | "knn" | "llm" | "manual" | "none";

export interface Categorization {
  category: Category;
  confidence: number;
  source: CategorySource;
  needsReview: boolean;
  ruleId?: string;
}

export interface CategorizedTransaction extends Transaction {
  merchantKey: string;
  apiEligible: boolean;
  categorization: Categorization;
}

export interface ApiCategorizeRequest {
  texts: string[];
  turnstileToken?: string;
}

export interface ApiCategorizeItem {
  text: string;
  category: Category;
  confidence: number;
  source: "cache" | "knn" | "llm";
}

export interface ApiCategorizeResponse {
  results: ApiCategorizeItem[];
  stats: {
    cached: number;
    embedded: number;
    fallback: number;
  };
}

export interface ApiDisabledResponse {
  disabled: true;
  reason: string;
}

export interface ApiStatusResponse {
  enabled: boolean;
  turnstile: boolean;
  reason?: string;
  missing?: string[];
}

export const THRESHOLDS = {
  accept: 0.8,
  review: 0.5,
} as const;

export const MAX_BODY_BYTES = 200_000;
export const MAX_TEXTS_PER_CALL = 500;
export const MAX_TEXT_LENGTH = 80;
export const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;
