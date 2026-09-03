import { describe, expect, test } from "vitest";
import { CATEGORIES } from "../categories";
import { createRuleEngine, loadRules, normalizeForRules } from "../rules";

const engine = createRuleEngine();

function match(counterparty: string, purpose = "", type = "Kartenzahlung", amount = -10) {
  return engine.match({ counterparty, purpose, type, amount })?.category ?? null;
}

describe("rules.json", () => {
  test("lädt und validiert alle Regeln", () => {
    const rules = loadRules();
    expect(rules.length).toBeGreaterThan(15);
    for (const r of rules) {
      expect(CATEGORIES).toContain(r.category);
      for (const p of r.patterns) expect(() => new RegExp(p, "i")).not.toThrow();
    }
  });
  test("ungültige Kategorie wird abgelehnt", () => {
    expect(() => loadRules({ rules: [{ id: "x", category: "Quatsch", field: "merchant", patterns: ["A"] }] })).toThrow(/unbekannter Kategorie/);
  });
});

describe("normalizeForRules", () => {
  test("Großschreibung, Umlaute, Satzzeichen", () => {
    expect(normalizeForRules("Gehalt/Lohn: März")).toBe("GEHALT LOHN MAERZ");
  });
});

describe("Regel-Engine: Beispiele", () => {
  test("Lebensmittel", () => {
    expect(match("REWE SAGT DANKE")).toBe("Lebensmittel");
    expect(match("ALDI SUED SAGT DANKE")).toBe("Lebensmittel");
    expect(match("EDEKA MUENCHEN")).toBe("Lebensmittel");
    expect(match("Lidl sagt Danke")).toBe("Lebensmittel");
  });
  test("Einkommen nur bei positiven Beträgen", () => {
    expect(match("Musterfirma GmbH", "Gehalt Januar 2026", "Eingang", 2850)).toBe("Einkommen");
    expect(match("Musterfirma GmbH", "Gehalt Januar 2026", "Überweisung", -2850)).not.toBe("Einkommen");
  });
  test("Wohnen und Energie", () => {
    expect(match("Hausverwaltung Schmidt", "Miete Januar", "Dauerauftrag", -780)).toBe("Wohnen");
    expect(match("Stadtwerke Muenchen", "Abschlag Strom", "Lastschrift", -100)).toBe("Energie");
    expect(match("ARD ZDF Deutschlandradio", "Rundfunkbeitrag", "Lastschrift", -55)).toBe("Wohnen");
  });
  test("Abos, Mobilität, Telekommunikation", () => {
    expect(match("Netflix International B.V.", "Netflix Mitgliedschaft", "Lastschrift", -12.99)).toBe("Abos & Medien");
    expect(match("Spotify AB", "", "Direct Debit", -10.99)).toBe("Abos & Medien");
    expect(match("Deutsche Bahn AG", "DB Vertrieb Fahrkarte", "Lastschrift", -89.9)).toBe("Mobilität");
    expect(match("ARAL Station 1234")).toBe("Mobilität");
    expect(match("Telekom Deutschland GmbH", "Mobilfunk Rechnung", "Lastschrift", -29.95)).toBe("Telekommunikation");
  });
  test("Bargeld und Gebühren", () => {
    expect(match("", "Bargeldauszahlung GA NR 12345", "Auszahlung", -100)).toBe("Bargeld");
    expect(match("", "Kontoführungsentgelt", "Entgelt", -4.9)).toBe("Gebühren & Zinsen");
  });
  test("Umbuchung", () => {
    expect(match("Trade Republic Bank GmbH", "Sparplan", "Überweisung", -200)).toBe("Umbuchung");
    expect(match("Max Mustermann", "Umbuchung auf Tagesgeld", "Überweisung", -500)).toBe("Umbuchung");
  });
  test("PayPal-Einkauf wird über den inneren Händler erkannt", () => {
    expect(match("PayPal Europe S.a.r.l. et Cie S.C.A", "PP.1234.PP . SPOTIFY, Ihr Einkauf bei SPOTIFY", "Lastschrift", -10.99)).toBe("Abos & Medien");
  });
  test("Unbekannte Händler liefern null", () => {
    expect(match("Franz Huber Schreinerei", "Rechnung 4711", "Überweisung", -300)).toBeNull();
    expect(match("XYZ Unbekannt")).toBeNull();
  });
  test("Rechtsform allein löst keine Regel aus", () => {
    expect(match("Irgendwas AG")).toBeNull();
  });
});
