import { describe, expect, test } from "vitest";
import { detectRecurring, monthlyEquivalent, monthlyRecurringTotal } from "../recurring";

function tx(id: string, date: string, amount: number, merchantKey: string, counterparty = merchantKey) {
  return { id, bookingDate: date, amount, merchantKey, counterparty };
}

describe("detectRecurring", () => {
  test("monatliche Abos: Netflix 12,99 alle 30 Tage ± 5", () => {
    const items = [
      tx("1", "2026-01-03", -12.99, "NETFLIX"),
      tx("2", "2026-02-03", -12.99, "NETFLIX"),
      tx("3", "2026-03-05", -12.99, "NETFLIX"),
      tx("4", "2026-04-03", -13.49, "NETFLIX"),
      tx("5", "2026-01-15", -45.6, "EDEKA"),
      tx("6", "2026-02-20", -31.2, "EDEKA"),
      tx("7", "2026-03-02", -80.1, "EDEKA"),
    ];
    const result = detectRecurring(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ merchantKey: "NETFLIX", rhythm: "monthly", occurrences: 4, amount: 12.99 });
  });

  test("Betragsabweichung über 5 % bricht die Kette", () => {
    const items = [tx("1", "2026-01-03", -29.9, "GYM"), tx("2", "2026-02-03", -29.9, "GYM"), tx("3", "2026-03-03", -39.9, "GYM")];
    expect(detectRecurring(items)).toHaveLength(0);
  });

  test("Abstand außerhalb der Toleranz bricht die Kette", () => {
    const items = [tx("1", "2026-01-03", -10, "X"), tx("2", "2026-02-03", -10, "X"), tx("3", "2026-04-15", -10, "X")];
    expect(detectRecurring(items)).toHaveLength(0);
  });

  test("jährliche Zahlungen: 365 Tage ± 15", () => {
    const items = [tx("1", "2025-03-01", -89, "VERSICHERUNG"), tx("2", "2026-03-10", -91, "VERSICHERUNG")];
    const result = detectRecurring(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rhythm: "yearly", occurrences: 2 });
  });

  test("Miete: Dauerauftrag monatlich mit gleichem Betrag", () => {
    const items = [
      tx("1", "2026-01-01", -780, "HAUSVERWALTUNG SCHMIDT"),
      tx("2", "2026-02-01", -780, "HAUSVERWALTUNG SCHMIDT"),
      tx("3", "2026-03-01", -780, "HAUSVERWALTUNG SCHMIDT"),
      tx("4", "2026-04-01", -780, "HAUSVERWALTUNG SCHMIDT"),
    ];
    const r = detectRecurring(items);
    expect(r[0]).toMatchObject({ amount: 780, rhythm: "monthly", firstDate: "2026-01-01", lastDate: "2026-04-01" });
    expect(r[0]?.transactionIds).toEqual(["1", "2", "3", "4"]);
  });

  test("quarterly: broadcasting fee 55.08 € on 15.01., 15.04. and 15.07. (gaps 90 and 91 days) is 18.36 € per month", () => {
    const items = [
      tx("1", "2026-01-15", -55.08, "RUNDFUNK ARD ZDF DRADIO"),
      tx("2", "2026-04-15", -55.08, "RUNDFUNK ARD ZDF DRADIO"),
      tx("3", "2026-07-15", -55.08, "RUNDFUNK ARD ZDF DRADIO"),
    ];
    const result = detectRecurring(items);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ rhythm: "quarterly", occurrences: 3, amount: 55.08 });
    expect(monthlyEquivalent(result[0]!)).toBe(18.36);
  });

  test("semiannual: two payments 181 days apart (182 ± 10)", () => {
    const items = [tx("1", "2026-01-10", -120, "HAFTPFLICHT"), tx("2", "2026-07-10", -120, "HAFTPFLICHT")];
    const result = detectRecurring(items);
    expect(result[0]).toMatchObject({ rhythm: "semiannual", occurrences: 2 });
    expect(monthlyEquivalent(result[0]!)).toBe(20);
  });

  test("two payments 60 days apart are not recurring", () => {
    const items = [tx("1", "2026-01-01", -40, "X"), tx("2", "2026-03-02", -40, "X")];
    expect(detectRecurring(items)).toHaveLength(0);
  });

  test("any other booking of the same merchant between two quarterly candidates breaks the quarterly pattern", () => {
    const similar = [tx("1", "2026-01-15", -45.6, "EDEKA"), tx("2", "2026-02-24", -45.8, "EDEKA"), tx("3", "2026-04-16", -45.7, "EDEKA")];
    expect(detectRecurring(similar)).toHaveLength(0);
    const different = [tx("1", "2026-01-15", -45.6, "EDEKA"), tx("2", "2026-02-24", -12.3, "EDEKA"), tx("3", "2026-04-16", -45.7, "EDEKA")];
    expect(detectRecurring(different)).toHaveLength(0);
  });

  test("monthly total: 12.99 + 55.08 / 3 + 120 / 6 + 89 / 12 = 12.99 + 18.36 + 20 + 7.4167 = 58.77", () => {
    expect(
      monthlyRecurringTotal([
        { amount: 12.99, rhythm: "monthly" },
        { amount: 55.08, rhythm: "quarterly" },
        { amount: 120, rhythm: "semiannual" },
        { amount: 89, rhythm: "yearly" },
      ]),
    ).toBe(58.77);
  });

  test("Eingänge und leere Händler werden ignoriert", () => {
    const items = [tx("1", "2026-01-01", 2850, "GEHALT"), tx("2", "2026-02-01", 2850, "GEHALT"), tx("3", "2026-03-01", 2850, "GEHALT"), tx("4", "2026-01-01", -5, ""), tx("5", "2026-02-01", -5, ""), tx("6", "2026-03-01", -5, "")];
    expect(detectRecurring(items)).toHaveLength(0);
  });
});
