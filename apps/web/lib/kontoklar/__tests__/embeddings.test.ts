import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  EMBEDDING_PRICE_USD_PER_MILLION_TOKENS,
  embedExamples,
  estimateCostUsd,
  estimateTokens,
  labeledEmbeddingsFile,
  prepareExamples,
} from "../embeddings";
import { normalizeMerchant } from "../merchant";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const EXAMPLES = (JSON.parse(readFileSync(path.join(ROOT, "data", "k2", "labeled-examples.json"), "utf-8")) as { examples: { text: string; category: string }[] }).examples;

function fakeEmbed(calls: string[][], dimension = 3) {
  return async (texts: string[]) => {
    calls.push(texts);
    return texts.map((text) => Array.from({ length: dimension }, (_, i) => (text.length + i) / 7));
  };
}

describe("prepareExamples", () => {
  test("normalizes like the browser, drops empty texts and unknown categories, keeps one entry per text (last wins)", () => {
    const prepared = prepareExamples([
      { text: "REWE Markt GmbH", category: "Lebensmittel" },
      { text: "rewe markt", category: "Drogerie & Haushalt" },
      { text: "   ", category: "Lebensmittel" },
      { text: "Kino Sternenzelt", category: "Gibt es nicht" },
      { text: "Stadtbad Nord", category: "Freizeit & Kultur" },
    ]);
    expect(prepared.items).toEqual([
      { text: normalizeMerchant("REWE Markt GmbH"), category: "Drogerie & Haushalt" },
      { text: normalizeMerchant("Stadtbad Nord"), category: "Freizeit & Kultur" },
    ]);
    expect(prepared.skipped).toBe(2);
    expect(prepared.conflicts).toEqual([normalizeMerchant("REWE Markt GmbH")]);
  });

  test("the example set in the repository contains no account or contact data and no contradictory labels", () => {
    const prepared = prepareExamples(EXAMPLES);
    const empty = EXAMPLES.filter((e) => normalizeMerchant(e.text) === "").map((e) => e.text);
    expect(empty).toEqual(["CASH26"]);
    expect(prepared.skipped).toBe(empty.length);
    expect(prepared.items.length).toBe(new Set(EXAMPLES.map((e) => normalizeMerchant(e.text)).filter((t) => t !== "")).size);
    expect(prepared.conflicts).toEqual([]);
    expect(prepared.items.every((item) => item.text === item.text.toUpperCase())).toBe(true);
  });

  test("refuses an example set with IBANs, e-mail addresses or long numbers before anything is sent or written", () => {
    expect(() => prepareExamples([{ text: "Ihr Einkauf bei max.muster@example.org", category: "Online-Handel" }])).toThrow("Konto- oder Kontaktdaten");
    expect(() => prepareExamples([{ text: "Miete DE12 5001 0517 0648 4898 90", category: "Wohnen" }])).toThrow("Beispieltext 0");
    expect(() => prepareExamples([{ text: "REWE", category: "Lebensmittel" }, { text: "Kunde 1234567", category: "Sonstiges" }])).toThrow("Beispieltext 1");
    expect(prepareExamples([{ text: "BLUME 2000", category: "Drogerie & Haushalt" }]).items).toHaveLength(1);
  });
});

describe("embedExamples", () => {
  const items = [
    { text: "A", category: "Lebensmittel" as const },
    { text: "BB", category: "Mobilität" as const },
    { text: "CCC", category: "Reisen" as const },
  ];

  test("embeds in batches, keeps the order and rounds every value to 5 decimals", async () => {
    const calls: string[][] = [];
    const progress: string[] = [];
    const vectors = await embedExamples(items, fakeEmbed(calls), { batchSize: 2, onBatch: (done, total) => progress.push(`${done}/${total}`) });
    expect(calls).toEqual([["A", "BB"], ["CCC"]]);
    expect(progress).toEqual(["2/3", "3/3"]);
    expect(vectors.map((v) => v.text)).toEqual(["A", "BB", "CCC"]);
    expect(vectors[0]!.vector).toEqual([0.14286, 0.28571, 0.42857]);
    expect(vectors[2]).toMatchObject({ category: "Reisen" });
  });

  test("stops when the provider returns too few vectors or vectors of different length", async () => {
    await expect(embedExamples(items, async (t) => t.slice(1).map(() => [1, 2]))).rejects.toThrow("2 statt 3 Vektoren");
    await expect(embedExamples(items, async (t) => t.map((x) => (x === "CCC" ? [1] : [1, 2])))).rejects.toThrow("1 statt 2 Dimensionen");
  });

  test("the file holds only model, date, count and text, category and vector per example", async () => {
    const vectors = await embedExamples(items, fakeEmbed([]));
    const file = labeledEmbeddingsFile("text-embedding-3-small", "2026-10-21", vectors.map((v) => ({ ...v, extra: "x" }) as typeof v));
    expect(Object.keys(file)).toEqual(["model", "createdAt", "count", "items"]);
    expect(file.count).toBe(3);
    expect(file.items.every((item) => Object.keys(item).join() === "text,category,vector")).toBe(true);
  });
});

describe("cost estimate", () => {
  test("about one token per three characters at 0,02 $ per million tokens", () => {
    expect(EMBEDDING_PRICE_USD_PER_MILLION_TOKENS).toBe(0.02);
    expect(estimateTokens(["REWE SAGT DANKE", "DB"])).toBe(5 + 1);
    expect(estimateCostUsd(1_000_000)).toBeCloseTo(0.02, 12);
    expect(estimateCostUsd(3_000)).toBeCloseTo(0.00006, 12);
  });
});
