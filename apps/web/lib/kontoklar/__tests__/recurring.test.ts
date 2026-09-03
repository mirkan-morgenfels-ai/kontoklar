import { describe, expect, test } from "vitest";
import { detectRecurring } from "../recurring";

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
    expect(result[0]).toMatchObject({ merchantKey: "NETFLIX", rhythm: "monatlich", occurrences: 4, amount: 12.99 });
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
    expect(result[0]).toMatchObject({ rhythm: "jaehrlich", occurrences: 2 });
  });

  test("Miete: Dauerauftrag monatlich mit gleichem Betrag", () => {
    const items = [
      tx("1", "2026-01-01", -780, "HAUSVERWALTUNG SCHMIDT"),
      tx("2", "2026-02-01", -780, "HAUSVERWALTUNG SCHMIDT"),
      tx("3", "2026-03-01", -780, "HAUSVERWALTUNG SCHMIDT"),
      tx("4", "2026-04-01", -780, "HAUSVERWALTUNG SCHMIDT"),
    ];
    const r = detectRecurring(items);
    expect(r[0]).toMatchObject({ amount: 780, rhythm: "monatlich", firstDate: "2026-01-01", lastDate: "2026-04-01" });
    expect(r[0]?.transactionIds).toEqual(["1", "2", "3", "4"]);
  });

  test("Eingänge und leere Händler werden ignoriert", () => {
    const items = [tx("1", "2026-01-01", 2850, "GEHALT"), tx("2", "2026-02-01", 2850, "GEHALT"), tx("3", "2026-03-01", 2850, "GEHALT"), tx("4", "2026-01-01", -5, ""), tx("5", "2026-02-01", -5, ""), tx("6", "2026-03-01", -5, "")];
    expect(detectRecurring(items)).toHaveLength(0);
  });
});
