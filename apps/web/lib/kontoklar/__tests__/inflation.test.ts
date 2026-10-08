import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { parseBankCsv } from "@portfolio/csv";
import cpiJson from "../../../../../data/k2/cpi.json";
import {
  APPROXIMATED_EXPENSE_CATEGORIES,
  CATEGORY_TO_COICOP,
  COICOP_APPROXIMATIONS,
  COICOP_DIVISIONS,
  EXPENSE_CATEGORIES,
  UNCOVERED_EXPENSE_CATEGORIES,
  coicopDivisionLabel,
  coicopLabel,
  joinGerman,
} from "../categories";
import { expenseAmountsByCategory, formatPercent } from "../analytics";
import { applyRules } from "../categorize";
import {
  CONTRIBUTION_STEP,
  SHARE_STEP,
  computePersonalInflation,
  displayWeights,
  expenseShares,
  normalizeToCovered,
  personalInflationFromChanges,
  roundToTotal,
  sharesByDivision,
  yearOverYearChange,
  type CpiData,
} from "../inflation";
import { SAMPLE_CSV_DEMO } from "../sample";

function pct(value: number, digits: number): string {
  return formatPercent(value, digits).replace(/ /g, " ");
}

describe("Beispielrechnung persönliche Inflation", () => {
  test("Anteile 30/40/15/15 mit +5/+2/+6/+3 ergeben 3,65 %", () => {
    const shares = new Map([
      ["01", 0.3],
      ["04", 0.4],
      ["07", 0.15],
      ["09", 0.15],
    ]);
    const changes = new Map([
      ["01", 0.05],
      ["04", 0.02],
      ["07", 0.06],
      ["09", 0.03],
    ]);
    const r = personalInflationFromChanges(shares, changes);
    expect(r.rate).toBeCloseTo(0.0365, 6);
    expect(r.covered).toBeCloseTo(1, 6);
  });
  test("fehlende Teilindizes werden auf die abgedeckten Anteile normiert", () => {
    const shares = new Map([
      ["01", 0.5],
      ["04", 0.5],
    ]);
    const changes = new Map([["01", 0.04]]);
    const r = personalInflationFromChanges(shares, changes);
    expect(r.rate).toBeCloseTo(0.04, 6);
    expect(r.covered).toBeCloseTo(0.5, 6);
  });
});

describe("expenseShares und COICOP-Zuordnung", () => {
  test("Einkommen und Umbuchung zählen nicht, Anteile summieren zu 1", () => {
    const shares = expenseShares({ Lebensmittel: -300, Wohnen: 400, Einkommen: 2850, Umbuchung: 500, Mobilität: 150, "Freizeit & Kultur": 150 });
    const sum = shares.reduce((s, x) => s + x.share, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(shares.find((s) => s.category === "Lebensmittel")?.share).toBeCloseTo(0.3, 10);
    expect(shares.some((s) => s.category === "Einkommen")).toBe(false);
  });
  test("Wohnen und Energie landen in Abteilung 04, Bargeld fällt weg", () => {
    const divisions = sharesByDivision(expenseShares({ Wohnen: 400, Energie: 100, Bargeld: 100 }));
    expect(divisions.get("04")).toBeCloseTo(500 / 600, 10);
    expect(divisions.has("bargeld")).toBe(false);
  });
  test("Online-Handel, Bargeld, Gebühren & Zinsen und Sonstiges sind nicht abgedeckt, Versicherungen gehen in Abteilung 12 ein", () => {
    expect(UNCOVERED_EXPENSE_CATEGORIES).toEqual(["Online-Handel", "Bargeld", "Gebühren & Zinsen", "Sonstiges"]);
    expect(CATEGORY_TO_COICOP.Versicherungen).toBe("12");
    const divisions = sharesByDivision(
      expenseShares({ Versicherungen: 100, "Online-Handel": 100, "Gebühren & Zinsen": 100, Sonstiges: 100, Bargeld: 100 }),
    );
    expect([...divisions.keys()]).toEqual(["12"]);
    expect(divisions.get("12")).toBeCloseTo(100 / 500, 10);
  });
  test("Drogerie & Haushalt (05), Versicherungen (12) und Reisen (11) sind als Näherung markiert", () => {
    expect(APPROXIMATED_EXPENSE_CATEGORIES).toEqual(["Drogerie & Haushalt", "Versicherungen", "Reisen"]);
    expect(CATEGORY_TO_COICOP["Drogerie & Haushalt"]).toBe("05");
    expect(CATEGORY_TO_COICOP.Versicherungen).toBe("12");
    expect(CATEGORY_TO_COICOP.Reisen).toBe("11");
    for (const category of COICOP_APPROXIMATIONS) expect(CATEGORY_TO_COICOP[category], category).not.toBeNull();
    expect(coicopLabel("Reisen")).toBe("11 Gaststätten- und Beherbergungsdienstleistungen (Näherung)");
    expect(coicopLabel("Versicherungen")).toBe("12 Andere Waren und Dienstleistungen (Näherung)");
    expect(coicopLabel("Lebensmittel")).toBe("01 Nahrungsmittel und alkoholfreie Getränke");
    expect(coicopLabel("Online-Handel")).toBe("nicht abgedeckt");
    expect(coicopDivisionLabel("Drogerie & Haushalt")).toBe("05 Möbel, Leuchten, Geräte und anderes Haushaltszubehör");
    expect(coicopDivisionLabel("Sonstiges")).toBeNull();
  });
  test("joinGerman verbindet die letzte Angabe mit „und“", () => {
    expect(joinGerman([])).toBe("");
    expect(joinGerman(["Bargeld"])).toBe("Bargeld");
    expect(joinGerman(["Reisen", "Bargeld"])).toBe("Reisen und Bargeld");
    expect(joinGerman(UNCOVERED_EXPENSE_CATEGORIES)).toBe("Online-Handel, Bargeld, Gebühren & Zinsen und Sonstiges");
    expect(joinGerman(APPROXIMATED_EXPENSE_CATEGORIES)).toBe("Drogerie & Haushalt, Versicherungen und Reisen");
  });
});

describe("yearOverYearChange", () => {
  test("Vorjahresvergleich desselben Monats", () => {
    const series = [
      { period: "2025-06", value: 120 },
      { period: "2026-06", value: 126 },
    ];
    const yoy = yearOverYearChange(series, "2026-06");
    expect(yoy?.fromPeriod).toBe("2025-06");
    expect(yoy?.change).toBeCloseTo(0.05, 10);
    expect(yearOverYearChange(series, "2026-07")).toBeNull();
  });
});

describe("computePersonalInflation mit cpi.json", () => {
  const cpi = cpiJson as CpiData;
  test("Datei ist als Beispiel markiert", () => {
    expect(cpi.sample).toBe(true);
  });
  test("liefert persönliche und amtliche Rate für den letzten Monat", () => {
    const r = computePersonalInflation(cpi, { Lebensmittel: 300, Wohnen: 400, Mobilität: 150, "Freizeit & Kultur": 150 });
    expect(r).not.toBeNull();
    expect(r!.toPeriod).toBe("2026-07");
    expect(r!.fromPeriod).toBe("2025-07");
    expect(r!.coveredShare).toBeCloseTo(1, 6);
    expect(r!.personalRate).toBeCloseTo(0.3 * 0.05 + 0.4 * 0.02 + 0.15 * 0.06 + 0.15 * 0.03, 3);
    expect(r!.officialRate).toBeCloseTo(0.028, 3);
    expect(r!.weights[0]?.division).toBe("04");
  });
  test("ohne Ausgaben keine Gewichte", () => {
    const r = computePersonalInflation(cpi, {});
    expect(r?.weights).toEqual([]);
    expect(r?.coveredWeights).toEqual([]);
    expect(r?.personalRate).toBe(0);
  });
  test("Lebensmittel 300 € and cash 100 €: rate 5.00 %, table share 100 %, contribution 5.00 %, covered 75 %", () => {
    const r = computePersonalInflation(cpi, { Lebensmittel: 300, Bargeld: 100 });
    const change01 = 126.38 / 120.36 - 1;
    expect(change01).toBeCloseTo(0.05, 3);
    expect(r!.coveredShare).toBeCloseTo(0.75, 10);
    expect(r!.personalRate).toBeCloseTo(change01, 10);
    expect(formatPercent(r!.personalRate, 2)).toBe(formatPercent(0.05, 2));
    expect(r!.coveredWeights).toHaveLength(1);
    expect(r!.coveredWeights[0]).toMatchObject({ division: "01" });
    expect(r!.coveredWeights[0]!.share).toBeCloseTo(1, 10);
    expect(r!.coveredWeights[0]!.contribution).toBeCloseTo(change01, 10);
    expect(r!.weights[0]!.share).toBeCloseTo(0.75, 10);
  });
  test("Lebensmittel 300 € and Online-Handel 100 €: rate 5.00 %, covered 75 %", () => {
    const r = computePersonalInflation(cpi, { Lebensmittel: 300, "Online-Handel": 100 });
    expect(r!.coveredShare).toBeCloseTo(300 / 400, 10);
    expect(r!.personalRate).toBeCloseTo(126.38 / 120.36 - 1, 10);
    expect(r!.coveredWeights.map((w) => w.division)).toEqual(["01"]);
  });
  test("normalized contributions add up to the personal rate", () => {
    const r = computePersonalInflation(cpi, { Lebensmittel: 300, Wohnen: 400, Mobilität: 150, "Freizeit & Kultur": 150, Bargeld: 200 });
    const shares = r!.coveredWeights.reduce((s, w) => s + w.share, 0);
    const contributions = r!.coveredWeights.reduce((s, w) => s + w.contribution, 0);
    expect(shares).toBeCloseTo(1, 10);
    expect(contributions).toBeCloseTo(r!.personalRate, 10);
    expect(r!.coveredShare).toBeCloseTo(1000 / 1200, 10);
  });
});

describe("COICOP mapping in the README", () => {
  test("the README table lists every expense category with the division used in the code and marks approximations", () => {
    const readme = readFileSync(path.resolve(__dirname, "..", "..", "..", "..", "..", "README.md"), "utf-8");
    const rows = new Map(
      [...readme.matchAll(/^\| ([^|]+?) \| (\d{2} [^|]+?|nicht abgedeckt) \|$/gm)].map((m) => [m[1]!, m[2]!]),
    );
    for (const category of EXPENSE_CATEGORIES) {
      const division = CATEGORY_TO_COICOP[category];
      const label = division ? `${division} ${COICOP_DIVISIONS[division]}` : "nicht abgedeckt";
      expect(rows.get(category)).toBe(COICOP_APPROXIMATIONS.has(category) ? `${label} (Näherung)` : label);
      expect(rows.get(category)).toBe(coicopLabel(category));
    }
    expect(rows.size).toBe(EXPENSE_CATEGORIES.length);
  });
});

describe("roundToTotal (largest remainder)", () => {
  test("three thirds in 0.1 % steps: 33.4 + 33.3 + 33.3 = 100.0 %, the tie goes to the first row", () => {
    const rounded = roundToTotal([1 / 3, 1 / 3, 1 / 3], SHARE_STEP, 1);
    expect(rounded.map((v) => Math.round(v / SHARE_STEP))).toEqual([334, 333, 333]);
  });
  test("contributions 1.0123 / 1.2820 / -0.0171 pp with rate 2.2772 %: naive 1.01 + 1.28 - 0.02 = 2.27, largest remainder 1.01 + 1.28 - 0.01 = 2.28", () => {
    const values = [0.010123, 0.01282, -0.000171];
    expect(values.map((v) => pct(v, 2))).toEqual(["1,01 %", "1,28 %", "-0,02 %"]);
    const rounded = roundToTotal(values, CONTRIBUTION_STEP, 0.022772);
    expect(rounded.map((v) => Math.round(v / CONTRIBUTION_STEP))).toEqual([101, 128, -1]);
    expect(rounded.map((v) => pct(v, 2))).toEqual(["1,01 %", "1,28 %", "-0,01 %"]);
  });
  test("an empty list stays empty", () => {
    expect(roundToTotal([], SHARE_STEP, 1)).toEqual([]);
    expect(displayWeights([], 0)).toEqual([]);
  });
});

describe("displayed shares and contributions add up", () => {
  const cpi = cpiJson as CpiData;
  const fixtures = path.resolve(__dirname, "..", "..", "..", "..", "..", "packages", "csv", "fixtures");
  const units = (rows: { share: number; contribution: number }[]) => ({
    shares: rows.reduce((s, w) => s + Math.round(w.share / SHARE_STEP), 0),
    contributions: rows.reduce((s, w) => s + Math.round(w.contribution / CONTRIBUTION_STEP), 0),
  });

  test("sample data: Online-Handel 363.44 €, Sonstiges 284.40 € and cash 100 € are not covered (9,835.48 of 10,583.32 €), shares 53.9 + 27.3 + 5.4 + 3.7 + 3.3 + 3.0 + 1.8 + 1.4 + 0.2 = 100.0 % (naive rounding gave 99.9 %), contributions add up to 3.02 %", () => {
    const r = computePersonalInflation(cpi, expenseAmountsByCategory(applyRules(parseBankCsv(SAMPLE_CSV_DEMO, "dkb").transactions)))!;
    const covered = 10583.32 - 363.44 - 284.4 - 100;
    expect(covered).toBeCloseTo(9835.48, 6);
    expect(r.coveredShare).toBeCloseTo(9835.48 / 10583.32, 10);
    expect(formatPercent(r.coveredShare, 0)).toBe(formatPercent(0.93, 0));
    expect(r.coveredWeights[0]!.share).toBeCloseTo((4790.16 + 510) / 9835.48, 10);
    expect(r.coveredWeights[1]!.share).toBeCloseTo(2687.08 / 9835.48, 10);
    expect(r.coveredWeights[2]!.share).toBeCloseTo(529.79 / 9835.48, 10);
    expect(r.coveredWeights[3]!.share).toBeCloseTo(356.9 / 9835.48, 10);
    expect(r.coveredWeights[4]!.share).toBeCloseTo(325.7 / 9835.48, 10);
    const change = (july2026: number) => july2026 / 120.36 - 1;
    const byHand =
      ((4790.16 + 510) * change(122.77) +
        2687.08 * change(126.38) +
        529.79 * change(127.58) +
        356.9 * change(125.17) +
        325.7 * change(120.96) +
        (149.94 + 143.88) * change(123.97) +
        179.7 * change(119.16) +
        139.88 * change(121.56) +
        22.45 * change(122.77)) /
      9835.48;
    expect(r.personalRate).toBeCloseTo(byHand, 10);
    expect(pct(r.personalRate, 2)).toBe("3,02 %");
    expect(r.coveredWeights.reduce((s, w) => s + Math.round(w.share / SHARE_STEP), 0)).toBe(999);
    const rows = displayWeights(r.coveredWeights, r.personalRate);
    expect(rows.map((w) => w.division)).toEqual(["04", "01", "07", "11", "05", "09", "08", "03", "06"]);
    expect(rows.map((w) => pct(w.share, 1))).toEqual([
      "53,9 %", "27,3 %", "5,4 %", "3,7 %", "3,3 %", "3,0 %", "1,8 %", "1,4 %", "0,2 %",
    ]);
    expect(rows.map((w) => pct(w.contribution, 2))).toEqual([
      "1,08 %", "1,37 %", "0,32 %", "0,15 %", "0,02 %", "0,09 %", "-0,02 %", "0,01 %", "0,00 %",
    ]);
    expect(units(rows)).toEqual({ shares: 1000, contributions: 302 });
  });

  test("ing.csv (naive shares 100.1 %) shows shares of exactly 100.0 %, n26.csv (naive contributions 5.97 %) shows contributions of exactly 5.96 %", () => {
    const expected: Record<string, { shares: string[]; contributions: string[]; rate: number; naive: { shares: number; contributions: number } }> = {
      "ing.csv": {
        shares: ["42,4 %", "38,2 %", "19,4 %"],
        contributions: ["0,85 %", "2,29 %", "0,97 %"],
        rate: 411,
        naive: { shares: 1001, contributions: 411 },
      },
      "n26.csv": {
        shares: ["98,6 %", "0,9 %", "0,5 %"],
        contributions: ["5,92 %", "0,02 %", "0,02 %"],
        rate: 596,
        naive: { shares: 1000, contributions: 597 },
      },
    };
    for (const [file, want] of Object.entries(expected)) {
      const r = computePersonalInflation(cpi, expenseAmountsByCategory(applyRules(parseBankCsv(readFileSync(path.join(fixtures, file), "utf-8")).transactions)))!;
      expect(units(r.coveredWeights), file).toEqual(want.naive);
      const rows = displayWeights(r.coveredWeights, r.personalRate);
      expect(rows.map((w) => pct(w.share, 1)), file).toEqual(want.shares);
      expect(rows.map((w) => pct(w.contribution, 2)), file).toEqual(want.contributions);
      expect(units(rows), file).toEqual({ shares: 1000, contributions: want.rate });
      expect(Math.round(r.personalRate / CONTRIBUTION_STEP), file).toBe(want.rate);
    }
  });

  test("n26.csv: Online-Handel 49.99 € is not covered, covered share 1,251.67 / 1,301.66 €", () => {
    const r = computePersonalInflation(cpi, expenseAmountsByCategory(applyRules(parseBankCsv(readFileSync(path.join(fixtures, "n26.csv"), "utf-8")).transactions)))!;
    expect(r.coveredShare).toBeCloseTo((1234.56 + 10.99 + 6.12) / (1234.56 + 49.99 + 10.99 + 6.12), 10);
    expect(r.coveredWeights.map((w) => w.division)).toEqual(["07", "09", "11"]);
  });
});

describe("normalizeToCovered", () => {
  test("divisions without an index value are dropped and the rest is scaled to 100 %", () => {
    const rows = normalizeToCovered([
      { division: "01", name: "A", share: 0.5, change: 0.04, contribution: 0.02 },
      { division: "04", name: "B", share: 0.25, change: 0.02, contribution: 0.005 },
      { division: "12", name: "C", share: 0.25, change: null, contribution: 0 },
    ]);
    expect(rows.map((w) => w.division)).toEqual(["01", "04"]);
    expect(rows[0]!.share).toBeCloseTo(2 / 3, 10);
    expect(rows[1]!.share).toBeCloseTo(1 / 3, 10);
    expect(rows[0]!.contribution + rows[1]!.contribution).toBeCloseTo((2 / 3) * 0.04 + (1 / 3) * 0.02, 10);
  });
});
