import { describe, expect, test } from "vitest";
import { applyRules, collectApiTexts } from "../categorize";
import { isApiEligible, merchantKeyFor, normalizeMerchant } from "../merchant";

describe("normalizeMerchant", () => {
  test("Rechenbeispiel: REWE SAGT DANKE bleibt erhalten", () => {
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
  test("Überweisungen an Empfänger ohne Firmenkennzeichen gehen nicht an die API", () => {
    expect(isApiEligible({ counterparty: "Max Mustermann", purpose: "Rückzahlung Abendessen", type: "Überweisung", amount: -20 })).toBe(false);
    expect(isApiEligible({ counterparty: "Erika Musterfrau", purpose: "Geschenk", type: "Credit Transfer", amount: -50 })).toBe(false);
  });
  test("Überweisungen an Firmen sind erlaubt", () => {
    expect(isApiEligible({ counterparty: "Hausverwaltung Schmidt GmbH", purpose: "Miete", type: "Dauerauftrag", amount: -780 })).toBe(true);
  });
  test("Eingänge gehen nie an die API", () => {
    expect(isApiEligible({ counterparty: "Musterfirma GmbH", purpose: "Gehalt", type: "Eingang", amount: 2850 })).toBe(false);
  });
  test("unknown booking type: company markers count only in the counterparty, never in the purpose", () => {
    expect(isApiEligible({ counterparty: "Anna Schmidt", purpose: "Rueckzahlung Sparkasse Kredit", type: "", amount: -50 })).toBe(false);
    expect(isApiEligible({ counterparty: "Anna Schmidt", purpose: "Anteil Einkauf Markt", type: "Ausgang", amount: -12 })).toBe(false);
    expect(isApiEligible({ counterparty: "Hausverwaltung Schmidt GmbH", purpose: "", type: "", amount: -780 })).toBe(true);
  });
  test("a counterparty that normalizes to nothing is never sent", () => {
    expect(normalizeMerchant("HUK24 AG")).toBe("");
    expect(isApiEligible({ counterparty: "HUK24 AG", purpose: "Kfz Beitrag Max Mustermann Vertrag 4711", type: "Lastschrift", amount: -45 })).toBe(false);
    expect(isApiEligible({ counterparty: "", purpose: "Kartenzahlung Laden", type: "Kartenzahlung", amount: -5 })).toBe(false);
  });
  test("card payment with a readable merchant stays eligible", () => {
    expect(isApiEligible({ counterparty: "Netflix", purpose: "", type: "Kartenzahlung", amount: -12.99 })).toBe(true);
  });
  test("PayPal purchase: the seller from 'Ihr Einkauf bei' needs a company marker, like a transfer recipient", () => {
    const paypal = "PayPal Europe S.a.r.l. et Cie S.C.A";
    expect(isApiEligible({ counterparty: paypal, purpose: "PP.5678.PP . Anna Schmidt, Ihr Einkauf bei Anna Schmidt", type: "Lastschrift", amount: -40 })).toBe(false);
    expect(isApiEligible({ counterparty: paypal, purpose: "PP.5678.PP . Kleinladen GmbH, Ihr Einkauf bei Kleinladen GmbH", type: "Lastschrift", amount: -40 })).toBe(true);
    expect(isApiEligible({ counterparty: paypal, purpose: "PP.1234.PP . KLEINLADEN, Ihr Einkauf bei KLEINLADEN", type: "Lastschrift", amount: -10 })).toBe(false);
  });
});

describe("collectApiTexts with PayPal purchases", () => {
  const paypal = "PayPal Europe S.a.r.l. et Cie S.C.A";
  const items = applyRules([
    { id: "1", bookingDate: "2026-01-02", valueDate: null, counterparty: paypal, purpose: "PP.5678.PP . Anna Schmidt, Ihr Einkauf bei Anna Schmidt", amount: -40, currency: "EUR", type: "Lastschrift", bank: "generic" },
    { id: "2", bookingDate: "2026-01-03", valueDate: null, counterparty: paypal, purpose: "PP.5679.PP . Kleinladen GmbH, Ihr Einkauf bei Kleinladen GmbH", amount: -25, currency: "EUR", type: "Lastschrift", bank: "generic" },
  ]);
  test("a private seller stays in the browser, a seller with a company marker is sent as the cleaned name", () => {
    expect(items[0]?.merchantKey).toBe("ANNA SCHMIDT");
    expect(items[0]?.categorization.source).toBe("none");
    const texts = collectApiTexts(items);
    expect(texts).toEqual(["KLEINLADEN"]);
    expect(texts).not.toContain("ANNA SCHMIDT");
  });
});

describe("collectApiTexts with private names and purpose fallback", () => {
  const items = applyRules([
    { id: "1", bookingDate: "2026-01-02", valueDate: null, counterparty: "Anna Schmidt", purpose: "Rueckzahlung Sparkasse Kredit", amount: -50, currency: "EUR", type: "", bank: "generic" },
    { id: "2", bookingDate: "2026-01-03", valueDate: null, counterparty: "Anna Schmidt", purpose: "Anteil Einkauf Markt", amount: -12, currency: "EUR", type: "Ausgang", bank: "generic" },
    { id: "3", bookingDate: "2026-01-04", valueDate: null, counterparty: "HUK24 AG", purpose: "Kfz Beitrag Max Mustermann Vertrag 4711", amount: -45, currency: "EUR", type: "Lastschrift", bank: "generic" },
    { id: "4", bookingDate: "2026-01-05", valueDate: null, counterparty: "Kleiner Laden Ost", purpose: "", amount: -9, currency: "EUR", type: "Kartenzahlung", bank: "generic" },
  ]);
  test("only the readable card merchant is collected", () => {
    const texts = collectApiTexts(items);
    expect(texts).toEqual(["KLEINER LADEN OST"]);
    expect(texts).not.toContain("ANNA SCHMIDT");
    expect(texts.join(" ")).not.toContain("KFZ BEITRAG MAX MUSTERMANN");
  });
  test("HUK24 is assigned by the insurance rule and stays local", () => {
    expect(items[2]?.merchantKey).toBe("KFZ BEITRAG MAX MUSTERMANN");
    expect(items[2]?.apiEligible).toBe(false);
    expect(items[2]?.categorization).toMatchObject({ category: "Versicherungen", source: "rule", ruleId: "insurance" });
  });
});
