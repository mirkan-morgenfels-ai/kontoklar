import { describe, expect, test } from "vitest";
import { classifyByKnn, cosineSimilarity, nearestNeighbors, voteKnn, type LabeledVector } from "../knn";

describe("cosineSimilarity", () => {
  test("identisch gerichtet = 1, orthogonal = 0, entgegengesetzt = -1", () => {
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });
  test("Handrechnung", () => {
    expect(cosineSimilarity([1, 1], [1, 0])).toBeCloseTo(Math.SQRT1_2, 10);
  });
  test("Nullvektor liefert 0, ungleiche Länge wirft", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(() => cosineSimilarity([1], [1, 2])).toThrow();
  });
});

describe("voteKnn", () => {
  test("Beispiel aus dem Umsetzungsdokument: REWE SAGT DANKE -> Lebensmittel mit 0,91", () => {
    const vote = voteKnn([
      { category: "Lebensmittel", similarity: 0.94, text: "REWE Filiale 123" },
      { category: "Lebensmittel", similarity: 0.88, text: "EDEKA Muenchen" },
      { category: "Drogerie & Haushalt", similarity: 0.71, text: "DM Drogerie" },
    ]);
    expect(vote.category).toBe("Lebensmittel");
    expect(vote.confidence).toBeCloseTo(0.91, 2);
  });
  test("ohne Mehrheit sinkt die Konfidenz unter 0,5", () => {
    const vote = voteKnn([
      { category: "Lebensmittel", similarity: 0.6 },
      { category: "Kleidung", similarity: 0.58 },
      { category: "Reisen", similarity: 0.57 },
    ]);
    expect(vote.category).toBe("Lebensmittel");
    expect(vote.confidence).toBeLessThan(0.5);
  });
  test("leere Nachbarn", () => {
    expect(voteKnn([])).toEqual({ category: null, confidence: 0, neighbors: [] });
  });
});

describe("nearestNeighbors und classifyByKnn", () => {
  const labeled: LabeledVector[] = [
    { text: "REWE", category: "Lebensmittel", vector: [1, 0, 0] },
    { text: "EDEKA", category: "Lebensmittel", vector: [0.9, 0.1, 0] },
    { text: "DM", category: "Drogerie & Haushalt", vector: [0.5, 0.5, 0] },
    { text: "NETFLIX", category: "Abos & Medien", vector: [0, 0, 1] },
  ];
  test("k nächste Nachbarn nach Ähnlichkeit sortiert", () => {
    const n = nearestNeighbors([1, 0.05, 0], labeled, 2);
    expect(n.map((x) => x.text)).toEqual(["REWE", "EDEKA"]);
  });
  test("Klassifikation", () => {
    const vote = classifyByKnn([0.95, 0.05, 0], labeled, 3);
    expect(vote.category).toBe("Lebensmittel");
    expect(vote.confidence).toBeGreaterThan(0.9);
    const other = classifyByKnn([0, 0, 1], labeled, 1);
    expect(other.category).toBe("Abos & Medien");
  });
});
