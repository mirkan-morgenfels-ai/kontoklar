import { IPV6_RATE_LIMIT_PREFIX_BITS, RATE_LIMIT_KEY_TTL_MS, RATE_LIMIT_REQUESTS } from "@portfolio/ratelimit";
import { IP_HASH_SECRET_MIN_LENGTH } from "./config";
import { CACHE_TTL_SECONDS, MAX_TEXTS_PER_CALL, THRESHOLDS } from "./types";

const SECONDS_PER_DAY = 86_400;
const MS_PER_HOUR = 3_600_000;

export const PRIVACY_FACTS = {
  cacheDays: CACHE_TTL_SECONDS / SECONDS_PER_DAY,
  maxTextsPerUpload: MAX_TEXTS_PER_CALL,
  fallbackBelowConfidence: THRESHOLDS.review,
  rateLimitRequests: RATE_LIMIT_REQUESTS,
  rateLimitRetentionHours: Math.floor(RATE_LIMIT_KEY_TTL_MS / MS_PER_HOUR),
  rateLimitRetentionExtraSeconds: (RATE_LIMIT_KEY_TTL_MS % MS_PER_HOUR) / 1000,
  ipHashSecretMinLength: IP_HASH_SECRET_MIN_LENGTH,
  ipv6PrefixBits: IPV6_RATE_LIMIT_PREFIX_BITS,
} as const;
