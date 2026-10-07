import { readFileSync } from "node:fs";
import path from "node:path";
import type { Transaction } from "@portfolio/csv";
import { describe, expect, test } from "vitest";
import { evaluateAccuracy, overlapReport, overlappingKeys, ruleEngineFigures, type AccuracyReport, type LabeledCase } from "../accuracy";
import { applyRules } from "../categorize";
import { normalizeMerchant } from "../merchant";

const ROOT = path.resolve(__dirname, "..", "..", "..", "..", "..");
const REPORT = JSON.parse(readFileSync(path.join(ROOT, "docs", "genauigkeit.json"), "utf-8")) as AccuracyReport;
const MARKDOWN = readFileSync(path.join(ROOT, "docs", "genauigkeit.md"), "utf-8");
const README = readFileSync(path.join(ROOT, "README.md"), "utf-8");

function tx(c: LabeledCase, i: number): Transaction {
  return { id: String(i), bookingDate: "2026-01-01", valueDate: null, counterparty: c.counterparty, purpose: c.purpose, amount: c.amount, currency: "EUR", type: c.type, bank: "generic" };
}

function german(value: number, digits = 1): string {
  return `${(100 * value).toFixed(digits).replace(".", ",")} %`;
}

describe("evaluateAccuracy", () => {
  const cases: LabeledCase[] = [
    { counterparty: "REWE SAGT DANKE", purpose: "", type: "Kartenzahlung", amount: -10, label: "Lebensmittel" },
    { counterparty: "Netflix", purpose: "", type: "Lastschrift", amount: -12.99, label: "Abos & Medien" },
    { counterparty: "Sanitaetshaus Mueller", purpose: "", type: "Kartenzahlung", amount: -25, label: "Gesundheit" },
    { counterparty: "Foto Meyer", purpose: "Passbilder", type: "Kartenzahlung", amount: -15, label: "Sonstiges" },
  ];
  const report = evaluateAccuracy(cases, applyRules(cases.map(tx)), { date: "2026-10-07", mode: "rule-only" });

  test("hand count: 3 rule hits, 2 correct, 1 open; total 2/4 = 0.5, assigned 2/3", () => {
    expect(report.stages).toEqual({ rule: { count: 3, correct: 2 }, unzugeordnet: { count: 1, correct: 0 } });
    expect(report.accuracyTotal).toBe(0.5);
    expect(report.accuracyAssigned).toBeCloseTo(2 / 3, 12);
  });

  test("precision and recall: Drogerie gets one false positive, Gesundheit one false negative", () => {
    const byCat = Object.fromEntries(report.perCategory.map((r) => [r.cat, r]));
    expect(byCat["Gesundheit"]).toMatchObject({ support: 1, precision: null, recall: 0 });
    expect(byCat["Lebensmittel"]).toMatchObject({ support: 1, precision: 1, recall: 1 });
    expect(byCat["Drogerie & Haushalt"]).toBeUndefined();
  });

  test("every error keeps the merchant text, truth, prediction and rule", () => {
    expect(report.errors).toEqual([
      { counterparty: "Sanitaetshaus Mueller", purpose: "", merchantKey: "SANITAETSHAUS MUELLER", truth: "Gesundheit", predicted: "Drogerie & Haushalt", source: "rule", ruleId: "drugstore" },
      { counterparty: "Foto Meyer", purpose: "Passbilder", merchantKey: "FOTO MEYER", truth: "Sonstiges", predicted: null, source: "none", ruleId: null },
    ]);
  });

  test("ruleEngineFigures: 190 of 198 by rule = 96.0 % coverage", () => {
    const figures = ruleEngineFigures({ total: 198, stages: { rule: { count: 190, correct: 188 } }, accuracyAssigned: 188 / 190, accuracyTotal: 188 / 198 });
    expect(german(figures.ruleCoverage)).toBe("96,0 %");
    expect(german(figures.accuracyAssigned)).toBe("98,9 %");
    expect(german(figures.accuracyTotal)).toBe("94,9 %");
  });

  test("overlappingKeys counts exact matches and keys that start an example text", () => {
    expect(overlappingKeys(["DEUTSCHES ROTES KREUZ", "REWE", "FOTO MEYER", ""], ["DEUTSCHES ROTES KREUZ SPENDE", "REWE", "FOTOMEYER"])).toEqual(["DEUTSCHES ROTES KREUZ", "REWE"]);
  });

  test("overlapReport: 3 of 4 keys overlap, but only 1 of the 2 texts that would be embedded", () => {
    const small: LabeledCase[] = [
      { counterparty: "REWE SAGT DANKE", purpose: "", type: "Kartenzahlung", amount: -10, label: "Lebensmittel" },
      { counterparty: "Foto Meyer", purpose: "Passbilder", type: "Kartenzahlung", amount: -15, label: "Sonstiges" },
      { counterparty: "Deutsches Rotes Kreuz", purpose: "Spende", type: "Lastschrift", amount: -20, label: "Sonstiges" },
      { counterparty: "Anna Schmidt", purpose: "Geschenk", type: "Überweisung", amount: -50, label: "Sonstiges" },
    ];
    const r = overlapReport(applyRules(small.map(tx)), ["REWE SAGT DANKE", "DEUTSCHES ROTES KREUZ SPENDE", "ANNA SCHMIDT"]);
    expect(r.keys).toBe(4);
    expect(r.overlapping).toEqual(["REWE SAGT DANKE", "DEUTSCHES ROTES KREUZ", "ANNA SCHMIDT"]);
    expect(r.apiTexts).toEqual(["FOTO MEYER", "DEUTSCHES ROTES KREUZ"]);
    expect(r.apiOverlapping).toEqual(["DEUTSCHES ROTES KREUZ"]);
  });
});

describe("overlap of test set and example set in genauigkeit.md", () => {
  const cases = (JSON.parse(readFileSync(path.join(ROOT, "data", "k2", "testset.json"), "utf-8")) as { cases: LabeledCase[] }).cases;
  const examples = (JSON.parse(readFileSync(path.join(ROOT, "data", "k2", "labeled-examples.json"), "utf-8")) as { examples: { text: string }[] }).examples.map((e) =>
    normalizeMerchant(e.text),
  );
  const r = overlapReport(applyRules(cases.map(tx)), examples);

  test("the documented counts match the data files", () => {
    expect(MARKDOWN).toContain(`${r.overlapping.length} der ${r.keys} Händlerschlüssel`);
    expect(MARKDOWN).toContain(`nur die ${r.apiTexts.length} Texte ohne Regeltreffer`);
    expect(MARKDOWN).toContain(`(${r.apiTexts.join(", ")})`);
    expect(MARKDOWN).toContain(`davon steht ${r.apiOverlapping.length} im Beispielset (${r.apiOverlapping.join(", ")})`);
    expect(MARKDOWN).toContain(`${r.apiTexts.length} Texte × etwa 8 Token ≈ ${8 * r.apiTexts.length} Token`);
  });
});

describe("documentation matches docs/genauigkeit.json", () => {
  const figures = ruleEngineFigures(REPORT);
  const numbers = [german(figures.ruleCoverage), german(figures.accuracyAssigned), german(figures.accuracyTotal)];

  test("the report is internally consistent", () => {
    const sum = Object.values(REPORT.stages).reduce((s, x) => s + x.count, 0);
    expect(sum).toBe(REPORT.total);
    expect(REPORT.errors).toHaveLength(REPORT.total - Object.values(REPORT.stages).reduce((s, x) => s + x.correct, 0));
  });

  test("genauigkeit.md and README name the same coverage and accuracy", () => {
    for (const value of numbers) {
      expect(MARKDOWN).toContain(value);
      expect(README).toContain(value);
    }
    expect(README).toContain(`${REPORT.total} `);
  });

  test("the error table in genauigkeit.md lists every error case with the right group size", () => {
    const groups = new Map<string, number>();
    for (const e of REPORT.errors) {
      const key = `${e.truth} | ${e.predicted ?? "offen"}`;
      groups.set(key, (groups.get(key) ?? 0) + 1);
      expect(MARKDOWN).toContain(e.counterparty);
    }
    const rows = [...MARKDOWN.matchAll(/^\| (\d+) \| ([^|]+) \| ([^|]+) \|/gm)].map((m) => [`${m[2]!.trim()} | ${m[3]!.trim()}`, Number(m[1])] as const);
    expect(new Map(rows)).toEqual(groups);
  });
});
