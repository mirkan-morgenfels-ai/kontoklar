import { isTurnstileTestKey } from "@portfolio/ratelimit";

export const IP_HASH_SECRET_MIN_LENGTH = 32;

export const API_REQUIREMENTS = [
  { env: "OPENAI_API_KEY", label: "OpenAI-Schlüssel", minLength: 1 },
  { env: "UPSTASH_REDIS_REST_URL", label: "Upstash-Redis-Adresse", minLength: 1 },
  { env: "UPSTASH_REDIS_REST_TOKEN", label: "Upstash-Redis-Token", minLength: 1 },
  { env: "TURNSTILE_SECRET_KEY", label: "geheimer Turnstile-Schlüssel", minLength: 1 },
  { env: "NEXT_PUBLIC_TURNSTILE_SITE_KEY", label: "öffentlicher Turnstile-Websiteschlüssel", minLength: 1 },
  { env: "IP_HASH_SECRET", label: `Schlüssel für die IP-Pseudonymisierung (mindestens ${IP_HASH_SECRET_MIN_LENGTH} Zeichen)`, minLength: IP_HASH_SECRET_MIN_LENGTH },
] as const;

export type ApiEnvName = (typeof API_REQUIREMENTS)[number]["env"];

const TURNSTILE_ENVS: readonly ApiEnvName[] = ["TURNSTILE_SECRET_KEY", "NEXT_PUBLIC_TURNSTILE_SITE_KEY"];

export interface ApiConfig {
  openAiKey: string;
  upstashUrl: string;
  upstashToken: string;
  turnstileSecret: string;
  turnstileSiteKey: string;
  ipHashSecret: string;
}

export type ApiConfigCheck = { ok: true; config: ApiConfig } | { ok: false; missing: ApiEnvName[]; testKeys: ApiEnvName[] };

type EnvSource = Record<string, string | undefined>;

export function isProductionEnv(env: EnvSource = process.env): boolean {
  return env.VERCEL_ENV ? env.VERCEL_ENV === "production" : env.NODE_ENV === "production";
}

export function readApiConfig(env: EnvSource = process.env): ApiConfigCheck {
  const value = (name: ApiEnvName) => env[name]?.trim() ?? "";
  const testKeys = isProductionEnv(env) ? TURNSTILE_ENVS.filter((name) => isTurnstileTestKey(value(name))) : [];
  const missing = API_REQUIREMENTS.filter((r) => value(r.env).length < r.minLength || testKeys.includes(r.env)).map((r) => r.env);
  if (missing.length > 0) return { ok: false, missing, testKeys };
  return {
    ok: true,
    config: {
      openAiKey: value("OPENAI_API_KEY"),
      upstashUrl: value("UPSTASH_REDIS_REST_URL"),
      upstashToken: value("UPSTASH_REDIS_REST_TOKEN"),
      turnstileSecret: value("TURNSTILE_SECRET_KEY"),
      turnstileSiteKey: value("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
      ipHashSecret: value("IP_HASH_SECRET"),
    },
  };
}

function describeEnvs(names: readonly ApiEnvName[]): string {
  return API_REQUIREMENTS.filter((r) => names.includes(r.env))
    .map((r) => `${r.label} (${r.env})`)
    .join(", ");
}

export function missingConfigReason(missing: readonly ApiEnvName[], testKeys: readonly ApiEnvName[] = []): string {
  const absent = missing.filter((name) => !testKeys.includes(name));
  const sentences: string[] = [];
  if (absent.length > 0) sentences.push(`Auf dem Server fehlt Konfiguration: ${describeEnvs(absent)}.`);
  if (testKeys.length > 0) sentences.push(`In der Produktionsumgebung sind die Cloudflare-Testschlüssel nicht zulässig: ${describeEnvs(testKeys)}.`);
  return sentences.join(" ");
}

export function turnstileConfigured(check: ApiConfigCheck): boolean {
  return check.ok || TURNSTILE_ENVS.every((name) => !check.missing.includes(name));
}
