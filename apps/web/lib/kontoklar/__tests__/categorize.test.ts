import type { Transaction } from "@portfolio/csv";
import { describe, expect, test, vi } from "vitest";
import { categoryTotals, monthlyBreakdown } from "../analytics";
import { applyManualToSameMerchant, applyRules, callCategorizeApi, collectApiTexts, fetchApiStatus, mergeApiResults, setManualCategory, summarize } from "../categorize";

function tx(partial: Partial<Transaction> & { id: string }): Transaction {
  return {
    bookingDate: "2026-01-02",
    valueDate: null,
    counterparty: "",
    purpose: "",
    amount: -10,
    currency: "EUR",
    type: "Kartenzahlung",
    bank: "dkb",
    ...partial,
  };
}

const sample: Transaction[] = [
  tx({ id: "a", counterparty: "REWE SAGT DANKE", amount: -133.72 }),
  tx({ id: "b", counterparty: "Netflix International B.V.", type: "Lastschrift", amount: -12.99, bookingDate: "2026-01-03" }),
  tx({ id: "c", counterparty: "Musterfirma GmbH", purpose: "Gehalt Januar", type: "Eingang", amount: 2850, bookingDate: "2026-01-05" }),
  tx({ id: "d", counterparty: "Franz Huber Schreinerei", purpose: "Rechnung 4711", type: "Überweisung", amount: -300, bookingDate: "2026-02-06" }),
  tx({ id: "e", counterparty: "Unbekannter Laden", type: "Kartenzahlung", amount: -25, bookingDate: "2026-02-07" }),
  tx({ id: "f", counterparty: "Unbekannter Laden", type: "Kartenzahlung", amount: -30, bookingDate: "2026-02-08" }),
  tx({ id: "g", counterparty: "Max Mustermann", purpose: "Rückzahlung", type: "Überweisung", amount: -20, bookingDate: "2026-02-09" }),
];

describe("applyRules", () => {
  const items = applyRules(sample);
  test("Regeltreffer haben Konfidenz 1 und keine Prüfung", () => {
    expect(items[0]?.categorization).toMatchObject({ category: "Lebensmittel", confidence: 1, source: "rule", needsReview: false, ruleId: "groceries" });
    expect(items[1]?.categorization.category).toBe("Abos & Medien");
    expect(items[2]?.categorization.category).toBe("Einkommen");
  });
  test("unbekannte Ausgaben sind Sonstiges mit Prüfmarkierung", () => {
    expect(items[4]?.categorization).toMatchObject({ category: "Sonstiges", source: "none", needsReview: true });
  });
  test("collectApiTexts sendet nur unbekannte, API-geeignete Händler, dedupliziert", () => {
    const texts = collectApiTexts(items);
    expect(texts).toEqual(["UNBEKANNTER LADEN"]);
    expect(texts).not.toContain("MAX MUSTERMANN");
    expect(texts).not.toContain("FRANZ HUBER SCHREINEREI");
  });
});

describe("mergeApiResults und manuelle Korrektur", () => {
  const items = applyRules(sample);
  test("API-Ergebnisse werden auf alle Buchungen desselben Händlers übertragen", () => {
    const merged = mergeApiResults(items, [{ text: "UNBEKANNTER LADEN", category: "Kleidung", confidence: 0.7, source: "knn" }]);
    expect(merged[4]?.categorization).toMatchObject({ category: "Kleidung", source: "knn", needsReview: true });
    expect(merged[5]?.categorization.category).toBe("Kleidung");
    expect(merged[0]?.categorization.source).toBe("rule");
  });
  test("Konfidenz ab 0,8 braucht keine Prüfung", () => {
    const merged = mergeApiResults(items, [{ text: "UNBEKANNTER LADEN", category: "Kleidung", confidence: 0.85, source: "knn" }]);
    expect(merged[4]?.categorization.needsReview).toBe(false);
  });
  test("setManualCategory und applyManualToSameMerchant", () => {
    const one = setManualCategory(items, "e", "Kleidung");
    expect(one[4]?.categorization).toMatchObject({ category: "Kleidung", source: "manual", confidence: 1 });
    expect(one[5]?.categorization.category).toBe("Sonstiges");
    const all = applyManualToSameMerchant(items, "UNBEKANNTER LADEN", "Kleidung");
    expect(all[4]?.categorization.category).toBe("Kleidung");
    expect(all[5]?.categorization.category).toBe("Kleidung");
  });
  test("summarize zählt Quellen", () => {
    const s = summarize(items);
    expect(s.total).toBe(7);
    expect(s.byRule).toBe(3);
    expect(s.uncategorized).toBe(4);
    expect(s.needsReview).toBe(4);
  });
});

describe("callCategorizeApi", () => {
  test("leere Liste ruft nichts auf", async () => {
    const fetchImpl = vi.fn();
    const r = await callCategorizeApi([], undefined, fetchImpl as unknown as typeof fetch);
    expect(r.ok).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  test("503 mit disabled wird als abgeschaltet gemeldet", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ disabled: true, reason: "kein Key" }), { status: 503 }));
    const r = await callCategorizeApi(["X"], undefined, fetchImpl as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: false, disabled: true, message: "kein Key" });
  });
  test("Body enthält nur texts und turnstileToken", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(["texts", "turnstileToken"]);
      expect(body.texts).toEqual(["REWE SAGT DANKE"]);
      return new Response(JSON.stringify({ results: [], stats: { cached: 0, embedded: 0, fallback: 0 } }), { status: 200 });
    });
    const r = await callCategorizeApi(["REWE SAGT DANKE"], "tok", fetchImpl as unknown as typeof fetch);
    expect(r.ok).toBe(true);
  });
});

describe("fetchApiStatus", () => {
  test("liest enabled und reason, fällt bei Fehlern auf deaktiviert zurück", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ enabled: true, turnstile: false }), { status: 200 }));
    expect(await fetchApiStatus(ok as unknown as typeof fetch)).toEqual({ enabled: true, turnstile: false, reason: undefined });
    const down = vi.fn(async () => {
      throw new Error("offline");
    });
    expect((await fetchApiStatus(down as unknown as typeof fetch)).enabled).toBe(false);
    const bad = vi.fn(async () => new Response("x", { status: 500 }));
    expect((await fetchApiStatus(bad as unknown as typeof fetch)).enabled).toBe(false);
  });
});

describe("analytics", () => {
  const items = applyRules(sample);
  test("monthlyBreakdown trennt Ausgaben und Einkommen je Monat", () => {
    const rows = monthlyBreakdown(items);
    expect(rows.map((r) => r.month)).toEqual(["2026-01", "2026-02"]);
    expect(rows[0]?.expenses).toBeCloseTo(146.71, 2);
    expect(rows[0]?.income).toBe(2850);
    expect(rows[0]?.byCategory.Lebensmittel).toBeCloseTo(133.72, 2);
  });
  test("categoryTotals sortiert absteigend mit Anteilen", () => {
    const totals = categoryTotals(items);
    expect(totals[0]?.category).toBe("Sonstiges");
    const sum = totals.reduce((s, t) => s + t.share, 0);
    expect(sum).toBeCloseTo(1, 10);
  });
});
