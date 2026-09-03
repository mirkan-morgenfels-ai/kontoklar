import { describe, expect, test } from "vitest";
import { parseAmount, parseDate, cleanText, makeTransactionId } from "../normalize";
import { decodeCsvBytes } from "../decode";
import { splitBuchungstext } from "../parsers/comdirect";

describe("parseAmount", () => {
  test("Dezimalkomma mit Tausenderpunkt", () => {
    expect(parseAmount("-1.234,56", "comma")).toBe(-1234.56);
    expect(parseAmount("2.850,00")).toBe(2850);
    expect(parseAmount("-133,72")).toBe(-133.72);
  });
  test("Dezimalpunkt (N26)", () => {
    expect(parseAmount("-49.99", "dot")).toBe(-49.99);
    expect(parseAmount("2850.00", "dot")).toBe(2850);
    expect(parseAmount("-12.99")).toBe(-12.99);
  });
  test("EUR-Suffix und Vorzeichen", () => {
    expect(parseAmount("-45,67 EUR")).toBe(-45.67);
    expect(parseAmount("+100,00 €")).toBe(100);
    expect(parseAmount("EUR 5,00")).toBe(5);
  });
  test("Auto-Erkennung bei Dot-Tausendern", () => {
    expect(parseAmount("1.200")).toBe(1200);
    expect(parseAmount("1,200.50")).toBe(1200.5);
  });
  test("ungültige Werte", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("-")).toBeNull();
  });
});

describe("parseDate", () => {
  test("TT.MM.JJJJ und TT.MM.JJ", () => {
    expect(parseDate("02.01.2026")).toBe("2026-01-02");
    expect(parseDate("03.01.26")).toBe("2026-01-03");
    expect(parseDate("3.1.2026")).toBe("2026-01-03");
  });
  test("ISO", () => {
    expect(parseDate("2026-03-02")).toBe("2026-03-02");
    expect(parseDate("2026-03-02T10:00:00Z")).toBe("2026-03-02");
  });
  test("ungültig", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("Alter Saldo")).toBeNull();
    expect(parseDate("32.13.2026")).toBeNull();
  });
});

describe("cleanText und id", () => {
  test("Whitespace wird normalisiert", () => {
    expect(cleanText("  REWE   SAGT\nDANKE ")).toBe("REWE SAGT DANKE");
    expect(cleanText(undefined)).toBe("");
  });
  test("Ids sind deterministisch und unterscheiden sich", () => {
    const a = makeTransactionId(["dkb", "2026-01-02", -133.72, "REWE", "", 0]);
    const b = makeTransactionId(["dkb", "2026-01-02", -133.72, "REWE", "", 0]);
    const c = makeTransactionId(["dkb", "2026-01-02", -133.72, "REWE", "", 1]);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(16);
  });
});

describe("decodeCsvBytes", () => {
  test("UTF-8 mit BOM", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Zahlungsempfänger")]);
    expect(decodeCsvBytes(bytes.buffer)).toBe("Zahlungsempfänger");
  });
  test("ISO-8859-1 Fallback", () => {
    const bytes = new Uint8Array([0x4d, 0xfc, 0x6e, 0x63, 0x68, 0x65, 0x6e]);
    expect(decodeCsvBytes(bytes.buffer)).toBe("München");
  });
});

describe("splitBuchungstext (comdirect)", () => {
  test("Auftraggeber und Buchungstext werden getrennt", () => {
    const r = splitBuchungstext("Auftraggeber: LIDL SAGT DANKE Buchungstext: 2026-02-11T18:22 Debitk.5 Ref. Q1/2");
    expect(r.counterparty).toBe("LIDL SAGT DANKE");
    expect(r.purpose).toBe("2026-02-11T18:22 Debitk.5 Q1/2");
  });
  test("Empfänger mit IBAN", () => {
    const r = splitBuchungstext(
      "Empfänger: Hausverwaltung Meier Kto/IBAN: DE02120300000000202051 BLZ/BIC: BYLADEM1001 Buchungstext: Miete Februar Ref. XYZ",
    );
    expect(r.counterparty).toBe("Hausverwaltung Meier");
    expect(r.purpose).toBe("Miete Februar XYZ");
    expect(r.purpose).not.toContain("DE02");
  });
  test("ohne Labels bleibt alles im Zweck", () => {
    const r = splitBuchungstext("Kontoführungsentgelt");
    expect(r.counterparty).toBe("");
    expect(r.purpose).toBe("Kontoführungsentgelt");
  });
});
