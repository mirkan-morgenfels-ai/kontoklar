import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { detectBank, parseBankCsv } from "@portfolio/csv";
import { monthlyBreakdown } from "../analytics";
import { applyRules, summarize } from "../categorize";
import { detectRecurring, monthlyEquivalent } from "../recurring";
import { SAMPLE_CSV_DEMO } from "../sample";

const FIXTURE = path.resolve(__dirname, "..", "..", "..", "..", "..", "packages", "csv", "fixtures", "demo-synthetic.csv");

describe("synthetic demo data", () => {
  const parsed = parseBankCsv(SAMPLE_CSV_DEMO, "dkb");
  const items = applyRules(parsed.transactions);

  test("embedded string equals the fixture file", () => {
    expect(SAMPLE_CSV_DEMO).toBe(readFileSync(FIXTURE, "utf-8"));
  });

  test("is detected as DKB and parses 147 bookings without skipped rows", () => {
    expect(detectBank(SAMPLE_CSV_DEMO)).toBe("dkb");
    expect(parsed.transactions).toHaveLength(147);
    expect(parsed.skipped).toBe(0);
  });

  test("covers six months from January to June 2026", () => {
    expect(monthlyBreakdown(items).map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
  });

  test("recurring: seven monthly payments and the quarterly broadcasting fee (55.08 / 3 = 18.36 per month)", () => {
    const recurring = detectRecurring(items.map((it) => ({ ...it, category: it.categorization.category })));
    expect(recurring.filter((r) => r.rhythm === "monthly")).toHaveLength(7);
    const fee = recurring.find((r) => r.merchantKey.startsWith("ARD ZDF"));
    expect(fee).toMatchObject({ rhythm: "quarterly", amount: 55.08, occurrences: 2 });
    expect(monthlyEquivalent(fee!)).toBe(18.36);
  });

  test("three unknown merchants and one private credit are marked for review", () => {
    const review = items.filter((it) => it.categorization.needsReview).map((it) => it.counterparty);
    expect(review.sort()).toEqual(["Atelier Lindgruen", "Erika Musterfrau", "Kiosk am Ring", "Schreinerei Kurz"]);
    expect(summarize(items).needsReview).toBe(4);
  });

  test("contains two credits besides the salary, one of them a refund from an online shop", () => {
    const credits = items.filter((it) => it.amount > 0 && !it.purpose.startsWith("Gehalt"));
    expect(credits.map((it) => it.counterparty).sort()).toEqual(["Amazon EU S.a.r.l.", "Erika Musterfrau"]);
  });

  test("names only fictitious people and businesses, IBANs only in the DE00 test format", () => {
    expect(new Set(parsed.transactions.map((it) => it.counterparty))).toEqual(
      new Set([
        "",
        "ALDI SUED SAGT DANKE",
        "ARAL Station 4711",
        "ARD ZDF Deutschlandradio Beitragsservice",
        "Amazon EU S.a.r.l.",
        "Atelier Lindgruen",
        "Backwerk",
        "Cafe Glockenspiel",
        "EDEKA Muenchen",
        "Erika Musterfrau",
        "FitX Deutschland GmbH",
        "H&M",
        "Hausverwaltung Schmidt",
        "Isar Apotheke",
        "Kiosk am Ring",
        "LIDL SAGT DANKE",
        "MVG Muenchen",
        "Musterfirma GmbH",
        "Netflix International B.V.",
        "Pizzeria Da Mario",
        "REWE SAGT DANKE",
        "Rossmann",
        "Schreinerei Kurz",
        "Spotify AB",
        "Stadtwerke Muenchen",
        "Starbucks Coffee",
        "Telekom Deutschland GmbH",
        "Zalando SE",
        "dm-drogerie markt",
      ]),
    );
    const ibans = SAMPLE_CSV_DEMO.match(/\bDE\d{20}\b/g) ?? [];
    expect(ibans.length).toBeGreaterThan(0);
    for (const iban of ibans) expect(iban.startsWith("DE00")).toBe(true);
    expect(SAMPLE_CSV_DEMO).toContain("Max Mustermann");
  });
});
