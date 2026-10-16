import { readFileSync } from "node:fs";
import path from "node:path";
import type { Transaction } from "@portfolio/csv";
import { describe, expect, test } from "vitest";
import {
  checkApiTestset,
  evaluateAccuracy,
  evaluateWithoutPurposeLabels,
  labelCounts,
  overlapReport,
  overlappingKeys,
  prefixOverlap,
  ruleEngineFigures,
  type AccuracyReport,
  type LabeledCase,
} from "../accuracy";
import { CATEGORIES, isCategory } from "../categories";
import { applyRules, collectApiTexts, mergeApiResults } from "../categorize";
import { normalizeMerchant } from "../merchant";
import { categorizeTexts } from "../server";

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

const EXAMPLES = (JSON.parse(readFileSync(path.join(ROOT, "data", "k2", "labeled-examples.json"), "utf-8")) as { examples: { text: string }[] }).examples.map((e) =>
  normalizeMerchant(e.text),
);

describe("overlap of test set and example set in genauigkeit.md", () => {
  const cases = (JSON.parse(readFileSync(path.join(ROOT, "data", "k2", "testset.json"), "utf-8")) as { cases: LabeledCase[] }).cases;
  const r = overlapReport(applyRules(cases.map(tx)), EXAMPLES);

  test("the documented counts match the data files", () => {
    expect(MARKDOWN).toContain(`${r.overlapping.length} der ${r.keys} Händlerschlüssel`);
    expect(MARKDOWN).toContain(`nur die ${r.apiTexts.length} Texte ohne Regeltreffer`);
    expect(MARKDOWN).toContain(`(${r.apiTexts.join(", ")})`);
    expect(MARKDOWN).toContain(`davon steht ${r.apiOverlapping.length} im Beispielset (${r.apiOverlapping.join(", ")})`);
  });
});

describe("prefixOverlap and checkApiTestset", () => {
  test("prefixOverlap: exact, key before example, example before key; never inside a word or with empty texts", () => {
    expect(prefixOverlap("REWE", "REWE")).toBe(true);
    expect(prefixOverlap("DEUTSCHES ROTES KREUZ", "DEUTSCHES ROTES KREUZ SPENDE")).toBe(true);
    expect(prefixOverlap("FRISEUR LENZ", "FRISEUR")).toBe(true);
    expect(prefixOverlap("FOTO", "FOTOSTUDIO")).toBe(false);
    expect(prefixOverlap("FEINBAECKEREI SOMMERFELD", "BAECKEREI RISCHART")).toBe(false);
    expect(prefixOverlap("", "REWE")).toBe(false);
    expect(prefixOverlap("REWE", "")).toBe(false);
  });

  test("hand-built set: one finding per broken condition, clean bookings pass", () => {
    const cases: LabeledCase[] = [
      { counterparty: "Teestube Samowar UG", purpose: "", type: "Kartenzahlung", amount: -9.6, label: "Restaurants & Cafés" },
      { counterparty: "REWE SAGT DANKE", purpose: "", type: "Kartenzahlung", amount: -10, label: "Lebensmittel" },
      { counterparty: "Anna Schmidt", purpose: "Geschenk", type: "Überweisung", amount: -50, label: "Sonstiges" },
      { counterparty: "PayPal Europe S.a.r.l. et Cie S.C.A", purpose: "Ihr Einkauf bei Max Muster", type: "Lastschrift", amount: -20, label: "Sonstiges" },
      { counterparty: "Teestube Samowar UG", purpose: "", type: "Kartenzahlung", amount: -4.2, label: "Restaurants & Cafés" },
      { counterparty: "Friseur Lenz GmbH", purpose: "", type: "Kartenzahlung", amount: -38, label: "Sonstiges" },
      { counterparty: "Feinbäckerei Sommerfeld GmbH", purpose: "", type: "Kartenzahlung", amount: -6.4, label: "Lebensmittel" },
      { counterparty: "Teestube Samowar UG", purpose: "Erstattung", type: "Gutschrift", amount: 5, label: "Restaurants & Cafés" },
      { counterparty: "", purpose: "", type: "Lastschrift", amount: -1, label: "Sonstiges" },
    ];
    const issues = checkApiTestset(applyRules(cases.map(tx)), ["FRISEUR", "FEINBAECKEREI SOMMERFELD FILIALE", ""]);
    expect(issues.map((i) => [i.index, i.kind, i.detail])).toEqual([
      [1, "rule-hit", "groceries"],
      [2, "not-eligible", "isApiEligible lässt die Buchung nicht zu"],
      [3, "not-eligible", "isApiEligible lässt die Buchung nicht zu"],
      [4, "duplicate-key", "wie Buchung 0"],
      [5, "example-overlap", "FRISEUR"],
      [6, "example-overlap", "FEINBAECKEREI SOMMERFELD FILIALE"],
      [7, "not-eligible", "isApiEligible lässt die Buchung nicht zu"],
      [7, "duplicate-key", "wie Buchung 0"],
      [8, "not-eligible", "isApiEligible lässt die Buchung nicht zu"],
      [8, "empty-key", "leerer Händlerschlüssel"],
    ]);
    expect(issues[3]).toMatchObject({ counterparty: "Teestube Samowar UG", merchantKey: "TEESTUBE SAMOWAR" });
  });

  test("evaluateWithoutPurposeLabels: hand count 2 of 4 with the purpose-only booking, 2 of 3 without it", async () => {
    const cases: LabeledCase[] = [
      { counterparty: "Teestube Samowar UG", purpose: "", type: "Kartenzahlung", amount: -9.6, label: "Restaurants & Cafés" },
      { counterparty: "Kartenwerk Payments GmbH", purpose: "Jahresentgelt Kreditkarte", type: "Lastschrift", amount: -29, label: "Gebühren & Zinsen", labelFromPurpose: true },
      { counterparty: "Grünkern Naturkost GmbH", purpose: "", type: "Kartenzahlung", amount: -38.15, label: "Lebensmittel" },
      { counterparty: "Zahlwerk Kontoservice GmbH", purpose: "Grundpreis Kontomodell", type: "Lastschrift", amount: -4.9, label: "Gebühren & Zinsen" },
    ];
    const answers: Record<string, string> = {
      "TEESTUBE SAMOWAR": "Restaurants & Cafés",
      "KARTENWERK PAYMENTS": "Online-Handel",
      "GRUENKERN NATURKOST": "Drogerie & Haushalt",
      "ZAHLWERK KONTOSERVICE": "Gebühren & Zinsen",
    };
    const ruled = applyRules(cases.map(tx));
    const res = await categorizeTexts(collectApiTexts(ruled), { cache: null, embed: null, labeled: [], fallback: async () => answers });
    const items = mergeApiResults(ruled, res.results);
    const options = { date: "2026-10-08", mode: "rule+knn+fallback" as const };

    const full = evaluateAccuracy(cases, items, options);
    expect(full.accuracyTotal).toBe(0.5);
    expect(full.perCategory.find((r) => r.cat === "Gebühren & Zinsen")).toMatchObject({ support: 2, precision: 1, recall: 0.5 });

    const split = evaluateWithoutPurposeLabels(cases, items, options);
    expect(split.excluded).toEqual(["KARTENWERK PAYMENTS"]);
    expect(split.report.total).toBe(3);
    expect(split.report.stages).toEqual({ llm: { count: 3, correct: 2 } });
    expect(split.report.accuracyTotal).toBeCloseTo(2 / 3, 12);
    expect(split.report.perCategory.find((r) => r.cat === "Gebühren & Zinsen")).toMatchObject({ support: 1, precision: 1, recall: 1 });
    expect(split.report.errors.map((e) => e.merchantKey)).toEqual(["GRUENKERN NATURKOST"]);

    expect(() => evaluateWithoutPurposeLabels(cases, items.slice(1), options)).toThrow("unterschiedliche Länge");
  });

  test("labelCounts counts each label once per booking", () => {
    const counts = labelCounts([{ label: "Lebensmittel" }, { label: "Bargeld" }, { label: "Lebensmittel" }]);
    expect([...counts.entries()]).toEqual([
      ["Lebensmittel", 2],
      ["Bargeld", 1],
    ]);
  });
});

describe("data/k2/testset-api.json", () => {
  const raw = JSON.parse(readFileSync(path.join(ROOT, "data", "k2", "testset-api.json"), "utf-8")) as {
    createdAt: string;
    createdBy: string;
    review: string;
    labelingGuide: Record<string, string>;
    cases: LabeledCase[];
  };
  const cases = raw.cases;
  const items = applyRules(cases.map(tx));
  const texts = collectApiTexts(items);

  test("is disjoint from the example set and the rules, and every booking would reach the API", () => {
    expect(checkApiTestset(items, EXAMPLES)).toEqual([]);
    expect(texts).toHaveLength(cases.length);
  });

  test("is large enough and balanced over every category the API can see", () => {
    expect(cases.length).toBeGreaterThanOrEqual(80);
    expect(cases.every((c) => isCategory(c.label) && c.amount < 0)).toBe(true);
    const counts = labelCounts(cases);
    expect(new Set(counts.keys())).toEqual(new Set(CATEGORIES.filter((c) => c !== "Einkommen")));
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(2);
  });

  test("names who built and labelled it, and has a labelling rule for every category", () => {
    expect(raw.createdAt).toBe("2026-10-08");
    expect(raw.createdBy).toContain("Claude");
    expect(raw.review).toContain("Autor");
    expect(Object.keys(raw.labelingGuide).sort()).toEqual([...CATEGORIES].sort());
  });

  test("runs through the API pipeline: a fallback that knows every label gives 100 %, none gives 0 %", async () => {
    const truth = new Map(items.map((it, i) => [it.merchantKey, cases[i]!.label]));
    const known = await categorizeTexts(texts, { cache: null, embed: null, labeled: [], fallback: async (t) => Object.fromEntries(t.map((x) => [x, truth.get(x)!])) });
    const full = evaluateAccuracy(cases, mergeApiResults(items, known.results), { date: "2026-10-08", mode: "rule+knn+fallback" });
    expect(full.stages).toEqual({ llm: { count: cases.length, correct: cases.length } });
    expect(full.accuracyTotal).toBe(1);

    const unknown = await categorizeTexts(texts, { cache: null, embed: null, labeled: [], fallback: async () => ({}) });
    const none = evaluateAccuracy(cases, mergeApiResults(items, unknown.results), { date: "2026-10-08", mode: "rule+knn+fallback" });
    expect(none.stages).toEqual({ unzugeordnet: { count: cases.length, correct: 0 } });
    expect(none.accuracyTotal).toBe(0);
  });

  test("upper bound: missing only the bookings with labelFromPurpose gives 92 of 95 = 96,8 % and 100 % without them", async () => {
    expect(cases.every((c) => c.labelFromPurpose === undefined || c.labelFromPurpose === true)).toBe(true);
    const fromPurpose = new Set(items.filter((_, i) => cases[i]!.labelFromPurpose === true).map((it) => it.merchantKey));
    expect(fromPurpose.size).toBe(3);
    const truth = new Map(items.map((it, i) => [it.merchantKey, cases[i]!.label]));
    const res = await categorizeTexts(texts, {
      cache: null,
      embed: null,
      labeled: [],
      fallback: async (t) => Object.fromEntries(t.map((x) => [x, fromPurpose.has(x) ? "Online-Handel" : truth.get(x)!])),
    });
    const merged = mergeApiResults(items, res.results);
    const options = { date: "2026-10-08", mode: "rule+knn+fallback" as const };
    const full = evaluateAccuracy(cases, merged, options);
    expect(full.stages).toEqual({ llm: { count: 95, correct: 92 } });
    expect(german(full.accuracyTotal)).toBe("96,8 %");
    expect(full.perCategory.find((r) => r.cat === "Gebühren & Zinsen")).toMatchObject({ support: 5, recall: 0.4 });

    const split = evaluateWithoutPurposeLabels(cases, merged, options);
    expect(new Set(split.excluded)).toEqual(fromPurpose);
    expect(split.report.total).toBe(92);
    expect(split.report.accuracyTotal).toBe(1);
  });

  test("genauigkeit.md and README name the bookings with labelFromPurpose and the upper bound", () => {
    const flagged = items.filter((_, i) => cases[i]!.labelFromPurpose === true);
    const n = cases.length;
    const f = flagged.length;
    expect(MARKDOWN).toContain(`Bei ${f} der ${n} Buchungen folgt das Label nur aus dem Verwendungszweck`);
    for (const it of flagged) expect(MARKDOWN).toContain(it.merchantKey);
    expect(MARKDOWN).toContain(`höchstens bei ${n - f} von ${n} (${german((n - f) / n)})`);
    for (const [cat, support] of labelCounts(cases)) {
      const inCat = flagged.filter((it) => cases[items.indexOf(it)]!.label === cat).length;
      if (inCat === 0) continue;
      expect(MARKDOWN).toContain(`Recall von ${cat} höchstens bei ${support - inCat} von ${support} (${german((support - inCat) / support, 0)})`);
    }
    expect(README).toContain(`Bei ${f} Buchungen`);
    expect(README).toContain(`höchstens ${german((n - f) / n)}`);
  });

  test("genauigkeit.md names its size, the per-category count and the cost estimate", () => {
    const perCategory = [...new Set(labelCounts(cases).values())];
    expect(perCategory).toHaveLength(1);
    expect(MARKDOWN).toContain(`${cases.length} synthetische Buchungen, je ${perCategory[0]} in den ${labelCounts(cases).size} Kategorien`);
    expect(MARKDOWN).toContain(`${texts.length} Texte × etwa 8 Token ≈ ${8 * texts.length} Token`);
    expect(README).toContain(`${cases.length} Buchungen`);
    const types = new Map<string, number>();
    for (const c of cases) types.set(c.type, (types.get(c.type) ?? 0) + 1);
    const paypal = cases.filter((c) => c.counterparty.startsWith("PayPal")).length;
    expect(types.size).toBe(4);
    expect(MARKDOWN).toContain(
      `${types.get("Kartenzahlung")} Kartenzahlungen, ${types.get("Lastschrift")} Lastschriften, ${types.get("Überweisung")} Überweisungen und ${types.get("Dauerauftrag")} Daueraufträge, darunter ${paypal} PayPal-Einkäufe`,
    );
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
