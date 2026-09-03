import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { decodeCsvBytes } from "../decode";
import { detectBank } from "../detect";
import { parseBankCsv, previewHeaders } from "../index";

function fixture(name: string): string {
  const buf = readFileSync(join(__dirname, "..", "..", "fixtures", name));
  return decodeCsvBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

describe("detectBank", () => {
  test("erkennt alle vier Banken", () => {
    expect(detectBank(fixture("dkb.csv"))).toBe("dkb");
    expect(detectBank(fixture("ing.csv"))).toBe("ing");
    expect(detectBank(fixture("comdirect.csv"))).toBe("comdirect");
    expect(detectBank(fixture("n26.csv"))).toBe("n26");
    expect(detectBank(fixture("generic-sparkasse.csv"))).toBe("unknown");
  });
});

describe("DKB", () => {
  const result = parseBankCsv(fixture("dkb.csv"));
  test("Kopfzeile ab Zeile 5, BOM, beide Datumsformate", () => {
    expect(result.bank).toBe("dkb");
    expect(result.transactions).toHaveLength(5);
    expect(result.skipped).toBe(1);
    expect(result.transactions[0]).toMatchObject({
      bookingDate: "2026-01-02",
      counterparty: "REWE SAGT DANKE",
      purpose: "NR12345 Einkauf",
      amount: -133.72,
      type: "Kartenzahlung",
    });
    expect(result.transactions[1]?.bookingDate).toBe("2026-01-03");
  });
  test("Gegenpartei je nach Vorzeichen", () => {
    const salary = result.transactions.find((t) => t.amount > 0);
    expect(salary?.counterparty).toBe("Musterfirma GmbH");
    expect(salary?.amount).toBe(2850);
    const rent = result.transactions.find((t) => t.amount === -780);
    expect(rent?.counterparty).toBe("Hausverwaltung Schmidt");
  });
  test("leerer Verwendungszweck ist erlaubt", () => {
    const aldi = result.transactions.find((t) => t.counterparty.startsWith("ALDI"));
    expect(aldi?.purpose).toBe("");
  });
});

describe("ING", () => {
  const result = parseBankCsv(fixture("ing.csv"));
  test("Metadaten vor der Kopfzeile werden übersprungen", () => {
    expect(result.transactions).toHaveLength(4);
    expect(result.skipped).toBe(0);
  });
  test("Felder", () => {
    expect(result.transactions[0]).toMatchObject({
      bookingDate: "2026-01-10",
      counterparty: "EDEKA MUENCHEN",
      type: "Lastschrift",
      purpose: "EDEKA SAGT DANKE 12345 MUENCHEN",
      amount: -45.67,
      currency: "EUR",
    });
    expect(result.transactions[2]?.amount).toBe(2850);
  });
});

describe("comdirect", () => {
  const result = parseBankCsv(fixture("comdirect.csv"));
  test("Buchungstext wird in Empfänger und Zweck getrennt", () => {
    expect(result.transactions).toHaveLength(4);
    const spotify = result.transactions[0];
    expect(spotify?.counterparty).toBe("PayPal Europe S.a.r.l. et Cie S.C.A");
    expect(spotify?.purpose).toContain("SPOTIFY");
    expect(spotify?.amount).toBe(-10.99);
    const rent = result.transactions[1];
    expect(rent?.counterparty).toBe("Hausverwaltung Meier");
    expect(rent?.purpose).toBe("Miete Februar XYZ");
  });
  test("Saldo-Zeilen werden ohne Warnung übersprungen", () => {
    expect(result.skipped).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });
  test("ISO-8859-1 wird dekodiert", () => {
    expect(result.transactions[1]?.type).toBe("Übertrag / Überweisung");
  });
});

describe("N26", () => {
  const result = parseBankCsv(fixture("n26.csv"));
  test("Komma-Trennung, englische Spalten, Dezimalpunkt", () => {
    expect(result.transactions).toHaveLength(5);
    expect(result.transactions[0]).toMatchObject({
      bookingDate: "2026-03-02",
      valueDate: "2026-03-02",
      counterparty: "Amazon EU S.a.r.L.",
      purpose: "Amazon.de Bestellung 302-1234567",
      amount: -49.99,
      type: "Presentment",
    });
    expect(result.transactions[2]?.amount).toBe(2850);
  });
  test("Fremdwährung: EUR-Betrag wird genommen", () => {
    const starbucks = result.transactions.find((t) => t.counterparty === "Starbucks Coffee");
    expect(starbucks?.amount).toBe(-6.12);
    expect(starbucks?.purpose).toBe("");
  });
  test("Beträge über 1.000 mit Dezimalpunkt", () => {
    expect(result.transactions[4]?.amount).toBe(-1234.56);
  });
});

describe("Generisches Mapping", () => {
  const text = fixture("generic-sparkasse.csv");
  test("Header-Vorschau", () => {
    const preview = previewHeaders(text);
    expect(preview.delimiter).toBe(";");
    expect(preview.columns).toEqual(["Datum", "Empfaenger", "Zweck", "Betrag EUR"]);
    expect(preview.sampleRows).toHaveLength(3);
  });
  test("Parsen mit Mapping", () => {
    const result = parseBankCsv(text, "generic", {
      bookingDate: "Datum",
      counterparty: "Empfaenger",
      purpose: "Zweck",
      amount: "Betrag EUR",
    });
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[2]?.amount).toBe(2850);
    expect(result.transactions[0]?.counterparty).toBe("Sparkasse Kunde Muster");
  });
  test("ohne Mapping und ohne Erkennung gibt es eine Fehlermeldung", () => {
    expect(() => parseBankCsv(text)).toThrow(/nicht erkannt/);
  });
});

describe("Grenzfälle", () => {
  test("leere Datei", () => {
    expect(() => parseBankCsv("")).toThrow();
  });
  test("nur Kopfzeile", () => {
    const header =
      '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"\n';
    const result = parseBankCsv(header);
    expect(result.bank).toBe("dkb");
    expect(result.transactions).toHaveLength(0);
  });
});
