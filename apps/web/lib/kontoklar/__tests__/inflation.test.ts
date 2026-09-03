import { describe, expect, test } from "vitest";
import cpiJson from "../../../../../data/k2/cpi.json";
import { computePersonalInflation, expenseShares, personalInflationFromChanges, sharesByDivision, yearOverYearChange, type CpiData } from "../inflation";

describe("Beispiel 2.3.5 aus dem Umsetzungsdokument", () => {
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
    expect(r?.personalRate).toBe(0);
  });
});
