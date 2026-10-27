import { readFileSync } from "node:fs";
import path from "node:path";
import type OpenAI from "openai";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_EMBEDDING_MODEL } from "../embeddings";
import { createOpenAiEmbed, createOpenAiFallback, embeddingModel, fallbackModel, measuredFallback } from "../providers";
import { DEFAULT_FALLBACK_MODEL } from "../types";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");

interface FallbackRequest {
  model: string;
  response_format: { type: string };
  messages: { role: string; content: string }[];
}

interface FakeResponse {
  content: string | null;
  usage?: { prompt_tokens: number; completion_tokens: number; completion_tokens_details?: { reasoning_tokens?: number } };
}

function fakeClient(...responses: (string | FakeResponse)[]) {
  const requests: FallbackRequest[] = [];
  let call = 0;
  const client = {
    chat: {
      completions: {
        create: async (request: FallbackRequest) => {
          requests.push(request);
          const next = responses[Math.min(call++, responses.length - 1)]!;
          const response = typeof next === "string" ? { content: next } : next;
          return { choices: [{ message: { content: response.content } }], usage: response.usage };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, requests };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Sprachmodell-Fallback", () => {
  test("Standardmodell ist gpt-5.6-luna, weil OpenAI gpt-5-nano am 11.12.2026 abschaltet", () => {
    expect(DEFAULT_FALLBACK_MODEL).toBe("gpt-5.6-luna");
  });

  test("ohne KONTOKLAR_FALLBACK_MODEL: ein Aufruf an gpt-5.6-luna im JSON-Modus, nur Anweisung und Händlernamen, Antwort wird zugeordnet", async () => {
    vi.stubEnv("KONTOKLAR_FALLBACK_MODEL", undefined);
    const { client, requests } = fakeClient('{"items":[{"i":0,"c":"Lebensmittel"},{"i":1,"c":"Keine Kategorie"}]}');
    const result = await createOpenAiFallback(client)(["FEINBAECKEREI SOMMERFELD", "KLETTERWERK NORDWAND"], ["Lebensmittel", "Sonstiges"]);
    expect(result).toEqual({ "FEINBAECKEREI SOMMERFELD": "Lebensmittel" });
    expect(requests).toHaveLength(1);
    const request = requests[0]!;
    expect(Object.keys(request).sort()).toEqual(["messages", "model", "response_format"]);
    expect(request.model).toBe("gpt-5.6-luna");
    expect(request.response_format).toEqual({ type: "json_object" });
    expect(request.messages.map((m) => m.role)).toEqual(["system", "user"]);
    expect(request.messages[0]!.content).toContain("Erlaubte Kategorien: Lebensmittel | Sonstiges.");
    expect(request.messages[0]!.content).toContain("JSON");
    expect(JSON.parse(request.messages[1]!.content)).toEqual([
      { i: 0, t: "FEINBAECKEREI SOMMERFELD" },
      { i: 1, t: "KLETTERWERK NORDWAND" },
    ]);
  });

  test("KONTOKLAR_FALLBACK_MODEL überschreibt den Standard", async () => {
    vi.stubEnv("KONTOKLAR_FALLBACK_MODEL", "gpt-5.6-terra");
    const { client, requests } = fakeClient('{"items":[]}');
    await createOpenAiFallback(client)(["KLETTERWERK NORDWAND"], ["Sonstiges"]);
    expect(requests[0]!.model).toBe("gpt-5.6-terra");
  });

  test("leere oder nur aus Leerzeichen bestehende Modellvariablen zählen als nicht gesetzt", async () => {
    for (const value of ["", "   "]) {
      vi.stubEnv("KONTOKLAR_FALLBACK_MODEL", value);
      vi.stubEnv("KONTOKLAR_EMBEDDING_MODEL", value);
      expect(fallbackModel()).toBe("gpt-5.6-luna");
      expect(embeddingModel()).toBe("text-embedding-3-small");
    }
    const embedRequests: { model: string; input: string[] }[] = [];
    const embedClient = {
      embeddings: {
        create: async (request: { model: string; input: string[] }) => {
          embedRequests.push(request);
          return { data: [{ index: 0, embedding: [0.5] }] };
        },
      },
    } as unknown as OpenAI;
    expect(await createOpenAiEmbed(embedClient)(["KLETTERWERK NORDWAND"])).toEqual([[0.5]]);
    expect(embedRequests[0]).toEqual({ model: DEFAULT_EMBEDDING_MODEL, input: ["KLETTERWERK NORDWAND"] });
    const { client, requests } = fakeClient('{"items":[]}');
    await createOpenAiFallback(client)(["KLETTERWERK NORDWAND"], ["Sonstiges"]);
    expect(requests[0]!.model).toBe("gpt-5.6-luna");
  });

  test("measuredFallback zählt Aufrufe, gesendete und zugeordnete Texte und Token: 2 gesendet, 1 zugeordnet, 120 + 300 Token davon 256 Reasoning; dann leere Antwort ohne Fehler und ohne Usage", async () => {
    vi.stubEnv("KONTOKLAR_FALLBACK_MODEL", undefined);
    const { client } = fakeClient(
      {
        content: '{"items":[{"i":0,"c":"Lebensmittel"},{"i":1,"c":"Erfunden"}]}',
        usage: { prompt_tokens: 120, completion_tokens: 300, completion_tokens_details: { reasoning_tokens: 256 } },
      },
      { content: null },
    );
    const { fallback, usage, model } = measuredFallback(client);
    expect(model).toBe("gpt-5.6-luna");
    expect(await fallback(["FEINBAECKEREI SOMMERFELD", "KLETTERWERK NORDWAND"], ["Lebensmittel", "Sonstiges"])).toEqual({
      "FEINBAECKEREI SOMMERFELD": "Lebensmittel",
    });
    expect(usage).toEqual({ calls: 1, sent: 2, assigned: 1, promptTokens: 120, completionTokens: 300, reasoningTokens: 256 });
    expect(await fallback(["INSELFAEHRE NORDRIFF"], ["Reisen"])).toEqual({});
    expect(usage).toEqual({ calls: 2, sent: 3, assigned: 1, promptTokens: 120, completionTokens: 300, reasoningTokens: 256 });
  });

  test(".env.example und die Variablentabelle im README nennen denselben Standard", () => {
    const envExample = readFileSync(path.join(ROOT, "apps", "web", ".env.example"), "utf-8");
    expect(envExample).toContain(`KONTOKLAR_FALLBACK_MODEL=${DEFAULT_FALLBACK_MODEL}\n`);
    const readme = readFileSync(path.join(ROOT, "README.md"), "utf-8");
    expect(readme).toContain(`| \`KONTOKLAR_FALLBACK_MODEL\` | \`${DEFAULT_FALLBACK_MODEL}\` |`);
  });
});
