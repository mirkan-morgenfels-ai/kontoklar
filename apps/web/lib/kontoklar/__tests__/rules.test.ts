import { describe, expect, test } from "vitest";
import { CATEGORIES } from "../categories";
import { createRuleEngine, loadRules, matchRule, normalizeForRules, type Rule } from "../rules";

const engine = createRuleEngine();

function ruleIdFor(counterparty: string, type: string) {
  return engine.match({ counterparty, purpose: "", type, amount: -10 })?.ruleId ?? null;
}

function alternatives(pattern: string): string[] {
  return pattern
    .replace(/\\b/g, "")
    .replace(/[()^$]/g, "")
    .split("|")
    .map((alt) => alt.trim())
    .filter((alt) => alt !== "");
}

function caseFor(rule: Rule, text: string) {
  const amount = rule.sign === "credit" ? 10 : -10;
  if (rule.field === "purpose") return { counterparty: rule.where === "bank-or-empty" ? "Sparkasse" : "", purpose: text, type: "", amount };
  if (rule.field === "type") return { counterparty: "", purpose: "", type: text, amount };
  return { counterparty: text, purpose: "", type: "", amount };
}

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
    expect(match("", "Kontoführungsentgelt", "Lastschrift", -4.9)).toBe("Gebühren & Zinsen");
    expect(match("DKB AG", "Sollzinsen", "Lastschrift", -5.4)).toBe("Gebühren & Zinsen");
    expect(match("N26", "Bank fee Metal", "Lastschrift", -16.9)).toBe("Gebühren & Zinsen");
  });
  test("Gebühren im Verwendungszweck zählen nicht bei Nicht-Bank-Empfängern", () => {
    expect(match("Stadtbibliothek Muenchen", "Jahresgebuehr", "Kartenzahlung", -20)).toBe("Bildung");
    expect(match("Stadt Muenchen KVR", "Personalausweis Gebuehr", "Kartenzahlung", -37)).toBeNull();
    expect(match("Musikschule Sendling", "Kursgebuehr Gitarre", "Lastschrift", -65)).toBe("Freizeit & Kultur");
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

const DIGIT_CASES: [string, string, string][] = [
  ["HOME24", "Kartenzahlung", "drugstore"],
  ["BLUME 2000", "Kartenzahlung", "drugstore"],
  ["1PASSWORD", "Lastschrift", "subscriptions"],
  ["OFFICE 365", "Lastschrift", "subscriptions"],
  ["MICROSOFT 365", "Lastschrift", "subscriptions"],
  ["TSV 1860", "Lastschrift", "leisure"],
  ["MAINZ 05", "Kartenzahlung", "leisure"],
  ["BET365", "Kartenzahlung", "leisure"],
  ["HUK24", "Lastschrift", "insurance"],
  ["CHECK24 REISE", "Kartenzahlung", "travel"],
  ["CHECK24", "Kartenzahlung", "online-retail"],
  ["BUEROSHOP24", "Kartenzahlung", "online-retail"],
  ["NU3", "Kartenzahlung", "online-retail"],
  ["1UND1", "Lastschrift", "telecom"],
  ["O2", "Lastschrift", "telecom"],
  ["CASH26", "Kartenzahlung", "cash-atm"],
];

describe("merchant patterns with digits", () => {
  test.each(DIGIT_CASES)("%s as counterparty (%s) hits rule %s", (counterparty, type, ruleId) => {
    expect(ruleIdFor(counterparty, type)).toBe(ruleId);
  });

  test("the digit list covers every alternative with a digit in rules.json", () => {
    const withDigits = loadRules()
      .filter((rule) => rule.field === "merchant" || rule.field === "any")
      .flatMap((rule) => rule.patterns.flatMap(alternatives))
      .filter((alt) => /\d/.test(alt) && !/^\d+&\d+$/.test(alt));
    expect(new Set(withDigits)).toEqual(new Set(DIGIT_CASES.map(([text]) => text)));
  });

  test("Blume 2000 from the test set is matched, HUK24 with a name in the purpose stays a rule hit", () => {
    expect(match("Blume 2000")).toBe("Drogerie & Haushalt");
    expect(match("HUK24 AG", "Kfz Beitrag Max Mustermann Vertrag 4711", "Lastschrift", -45)).toBe("Versicherungen");
  });

  test("PayPal purchases keep the inner merchant, not the PayPal counterparty", () => {
    expect(match("PayPal Europe S.a.r.l. et Cie S.C.A", "PP.1234.PP . KLEINLADEN, Ihr Einkauf bei KLEINLADEN", "Lastschrift", -10)).toBeNull();
  });
});

describe("every pattern alternative hits its own rule", () => {
  for (const rule of loadRules()) {
    test(`rule ${rule.id}`, () => {
      const missed = rule.patterns.flatMap(alternatives).filter((alt) => !matchRule(rule, caseFor(rule, alt)));
      expect(missed).toEqual([]);
    });
  }
});
