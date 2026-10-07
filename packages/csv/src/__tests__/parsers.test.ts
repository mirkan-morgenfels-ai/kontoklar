import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { decodeCsvBytes, detectFileKind } from "../decode";
import { detectBank } from "../detect";
import { parseBankCsv, previewHeaders } from "../index";

function fixture(name: string): string {
  const buf = readFileSync(join(__dirname, "..", "..", "fixtures", name));
  return decodeCsvBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

describe("detectBank", () => {
  test("erkennt DKB, ING, comdirect, N26, VR-Bank (neu und alt) und Sparkasse, generische Datei bleibt unbekannt", () => {
    expect(detectBank(fixture("dkb.csv"))).toBe("dkb");
    expect(detectBank(fixture("ing.csv"))).toBe("ing");
    expect(detectBank(fixture("comdirect.csv"))).toBe("comdirect");
    expect(detectBank(fixture("n26.csv"))).toBe("n26");
    expect(detectBank(fixture("vrbank.csv"))).toBe("vrbank");
    expect(detectBank(fixture("vrbank-alt.csv"))).toBe("vrbank");
    expect(detectBank(fixture("sparkasse.csv"))).toBe("sparkasse");
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
  test("an empty counterparty column never falls back to the account holder in the other column", () => {
    const header =
      '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"';
    const rows = [
      '"10.01.2026";"10.01.2026";"Gebucht";"Max Mustermann";"";"Bargeldauszahlung";"Kartenzahlung";"";"-50,00";"";"";""',
      '"11.01.2026";"11.01.2026";"Gebucht";"";"Max Mustermann";"Zinsen";"Eingang";"";"1,20";"";"";""',
    ];
    const parsed = parseBankCsv([header, ...rows].join("\n"), "dkb");
    expect(parsed.transactions.map((t) => t.counterparty)).toEqual(["", ""]);
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

describe("VR-Bank (neues Exportformat)", () => {
  const result = parseBankCsv(fixture("vrbank.csv"));
  test("Felder, Windows-1252 und Vorzeichen", () => {
    expect(result.transactions).toHaveLength(4);
    expect(result.transactions[0]).toMatchObject({
      bookingDate: "2026-03-03",
      counterparty: "REWE SAGT DANKE. 45123456",
      purpose: "NR12345 Einkauf 02.03.2026",
      amount: -42.17,
      type: "Kartenzahlung",
      currency: "EUR",
    });
    expect(result.transactions[1]?.purpose).toBe("Abschlag Strom März");
    expect(result.transactions[2]?.amount).toBe(2850);
  });
});

describe("VR-Bank (altes Exportformat mit Soll/Haben)", () => {
  const result = parseBankCsv(fixture("vrbank-alt.csv"));
  test("Soll wird negativ, Haben positiv, Vorgang und Zweck getrennt", () => {
    expect(result.transactions).toHaveLength(3);
    expect(result.transactions[0]).toMatchObject({ counterparty: "EDEKA MUENCHEN", amount: -45.67, type: "Kartenzahlung", purpose: "EDEKA SAGT DANKE 12345 MUENCHEN" });
    expect(result.transactions[1]).toMatchObject({ counterparty: "Musterfirma GmbH", amount: 2850, type: "Gehalt/Rente" });
    expect(result.transactions[2]?.amount).toBe(-780);
    expect(result.warnings).toHaveLength(0);
  });
});

describe("Sparkasse (CAMT-CSV)", () => {
  const result = parseBankCsv(fixture("sparkasse.csv"));
  test("zweistellige Jahre, Umlaut-freie Kopfzeile, leerer Empfänger", () => {
    expect(result.transactions).toHaveLength(4);
    expect(result.transactions[0]).toMatchObject({ bookingDate: "2026-01-14", counterparty: "LIDL SAGT DANKE", amount: -31.2, type: "KARTENZAHLUNG" });
    expect(result.transactions[2]?.amount).toBe(2850);
    expect(result.transactions[3]).toMatchObject({ counterparty: "", amount: -100, type: "BARGELDAUSZAHLUNG" });
  });
});

describe("detectFileKind", () => {
  test("PDF, ZIP, Text, leer", () => {
    expect(detectFileKind(new TextEncoder().encode("%PDF-1.7 ...").buffer)).toBe("pdf");
    expect(detectFileKind(new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer)).toBe("zip");
    expect(detectFileKind(new TextEncoder().encode("Buchungstag;Betrag\n01.01.2026;-1,00\n").buffer)).toBe("text");
    expect(detectFileKind(new ArrayBuffer(0))).toBe("empty");
    expect(detectFileKind(new Uint8Array([0x00, 0x01, 0x02]).buffer)).toBe("binary");
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

describe("CRLF line endings", () => {
  const crlf = (text: string) => text.replace(/\r?\n/g, "\r\n");

  test.each(["dkb.csv", "vrbank.csv", "vrbank-alt.csv", "ing.csv", "sparkasse.csv"])("%s gives the same bookings with CRLF as with LF", (name) => {
    const lf = fixture(name);
    const windows = crlf(lf);
    expect(windows).toContain("\r\n");
    const a = parseBankCsv(lf);
    const b = parseBankCsv(windows);
    expect(b.bank).toBe(a.bank);
    expect(b.skipped).toBe(a.skipped);
    expect(b.transactions).toEqual(a.transactions);
  });

  test("DKB with CRLF: first booking is read without a trailing carriage return", () => {
    const result = parseBankCsv(crlf(fixture("dkb.csv")));
    expect(result.transactions[0]).toMatchObject({ counterparty: "REWE SAGT DANKE", purpose: "NR12345 Einkauf", amount: -133.72, type: "Kartenzahlung" });
    for (const tx of result.transactions) expect(JSON.stringify(tx)).not.toContain("\\r");
  });

  test("old VR-Bank format with CRLF inside the quoted field still splits type and purpose", () => {
    const result = parseBankCsv(crlf(fixture("vrbank-alt.csv")));
    expect(result.transactions[0]).toMatchObject({ type: "Kartenzahlung", purpose: "EDEKA SAGT DANKE 12345 MUENCHEN", amount: -45.67 });
  });
});

describe("duplicate header names", () => {
  test("ING: the second currency column becomes Währung_2 and Papa Parse stays silent", () => {
    const warnings: unknown[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      const result = parseBankCsv(fixture("ing.csv"));
      expect(result.transactions.length).toBeGreaterThan(0);
      expect(result.transactions.every((tx) => tx.currency === "EUR")).toBe(true);
    } finally {
      console.warn = original;
    }
    expect(warnings).toEqual([]);
  });
});
