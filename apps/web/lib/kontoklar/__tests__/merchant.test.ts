import { describe, expect, test } from "vitest";
import { isApiEligible, merchantKeyFor, normalizeMerchant } from "../merchant";

describe("normalizeMerchant", () => {
  test("Beispiel aus dem Umsetzungsdokument bleibt erhalten", () => {
    expect(normalizeMerchant("REWE SAGT DANKE")).toBe("REWE SAGT DANKE");
  });
  test("IBAN, BIC, Datum, Uhrzeit, Nummern werden entfernt", () => {
    expect(normalizeMerchant("Hausverwaltung Meier DE02120300000000202051 BYLADEM1001 12.02.2026 18:22")).toBe("HAUSVERWALTUNG MEIER");
    expect(normalizeMerchant("EDEKA SAGT DANKE 12345 MUENCHEN")).toBe("EDEKA SAGT DANKE MUENCHEN");
    expect(normalizeMerchant("Netflix Mitgliedschaft 123456")).toBe("NETFLIX MITGLIEDSCHAFT");
  });
  test("SEPA-Tags, Zahlungsart und Rechtsformen werden entfernt", () => {
    expect(normalizeMerchant("Netflix International B.V.")).toBe("NETFLIX INTERNATIONAL");
    expect(normalizeMerchant("Musterfirma GmbH & Co. KG")).toBe("MUSTERFIRMA");
    expect(normalizeMerchant("LIDL SAGT DANKE Kartenzahlung girocard Debitk.5 2028-12")).toBe("LIDL SAGT DANKE");
    expect(normalizeMerchant("EREF+ABC123 MREF+M-123 CRED+DE12ZZZ00000012345 SVWZ+Miete")).toBe("MIETE");
  });
  test("Umlaute und Sonderzeichen", () => {
    expect(normalizeMerchant("Bäckerei Müller")).toBe("BAECKEREI MUELLER");
    expect(normalizeMerchant("Café Ölmühle/Straße")).toBe("CAF OELMUEHLE STRASSE");
  });
  test("Längenbegrenzung", () => {
    expect(normalizeMerchant("A".repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe("merchantKeyFor", () => {
  test("nimmt den Empfänger, nicht den Verwendungszweck", () => {
    const key = merchantKeyFor({ counterparty: "REWE SAGT DANKE", purpose: "NR12345 Einkauf Max Mustermann" });
    expect(key).toBe("REWE SAGT DANKE");
    expect(key).not.toContain("MUSTERMANN");
  });
  test("PayPal: Händler aus 'Ihr Einkauf bei' übernehmen", () => {
    const key = merchantKeyFor({
      counterparty: "PayPal Europe S.a.r.l. et Cie S.C.A",
      purpose: "1030123456789 PP.1234.PP . SPOTIFY, Ihr Einkauf bei SPOTIFY",
    });
    expect(key).toBe("SPOTIFY");
  });
  test("leerer Empfänger: höchstens vier Wörter aus dem Zweck", () => {
    const key = merchantKeyFor({ counterparty: "", purpose: "Kontoführungsentgelt für Konto Januar Februar März" });
    expect(key.split(" ").length).toBeLessThanOrEqual(4);
    expect(key).toContain("KONTOFUEHRUNGSENTGELT");
  });
});

describe("isApiEligible", () => {
  test("Kartenzahlungen und Lastschriften sind erlaubt", () => {
    expect(isApiEligible({ counterparty: "Irgendein Laden", purpose: "", type: "Kartenzahlung", amount: -5 })).toBe(true);
    expect(isApiEligible({ counterparty: "Fitness Club", purpose: "", type: "Lastschrift", amount: -29.9 })).toBe(true);
    expect(isApiEligible({ counterparty: "Amazon", purpose: "", type: "Presentment", amount: -5 })).toBe(true);
  });
  test("Überweisungen an Privatpersonen gehen nie an die API", () => {
    expect(isApiEligible({ counterparty: "Max Mustermann", purpose: "Rückzahlung Abendessen", type: "Überweisung", amount: -20 })).toBe(false);
    expect(isApiEligible({ counterparty: "Erika Musterfrau", purpose: "Geschenk", type: "Credit Transfer", amount: -50 })).toBe(false);
  });
  test("Überweisungen an Firmen sind erlaubt", () => {
    expect(isApiEligible({ counterparty: "Hausverwaltung Schmidt GmbH", purpose: "Miete", type: "Dauerauftrag", amount: -780 })).toBe(true);
  });
  test("Eingänge gehen nie an die API", () => {
    expect(isApiEligible({ counterparty: "Musterfirma GmbH", purpose: "Gehalt", type: "Eingang", amount: 2850 })).toBe(false);
  });
});
