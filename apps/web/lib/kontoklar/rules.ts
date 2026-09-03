import type { Transaction } from "@portfolio/csv";
import rulesJson from "../../../../data/k2/rules.json";
import { isCategory, type Category } from "./categories";
import { merchantKeyFor } from "./merchant";

export type RuleField = "merchant" | "purpose" | "type" | "any";
export type RuleSign = "debit" | "credit";

export interface Rule {
  id: string;
  category: Category;
  field: RuleField;
  sign?: RuleSign;
  patterns: string[];
}

interface CompiledRule {
  id: string;
  category: Category;
  field: RuleField;
  sign?: RuleSign;
  regexes: RegExp[];
}

export interface RuleMatch {
  category: Category;
  ruleId: string;
}

export function normalizeForRules(text: string): string {
  return text
    .toUpperCase()
    .replace(/[ÄÖÜ]/g, (c) => ({ Ä: "AE", Ö: "OE", Ü: "UE" })[c] ?? c)
    .replace(/ß/g, "SS")
    .replace(/[./,:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function loadRules(source: unknown = rulesJson): Rule[] {
  const parsed = source as { rules?: unknown };
  if (!parsed || !Array.isArray(parsed.rules)) throw new Error("rules.json: Feld rules fehlt");
  return parsed.rules.map((raw, i) => {
    const r = raw as Partial<Rule>;
    if (typeof r.id !== "string" || r.id === "") throw new Error(`rules.json: Regel ${i} ohne id`);
    if (typeof r.category !== "string" || !isCategory(r.category)) throw new Error(`rules.json: Regel ${r.id} mit unbekannter Kategorie`);
    if (!Array.isArray(r.patterns) || r.patterns.length === 0) throw new Error(`rules.json: Regel ${r.id} ohne patterns`);
    const field: RuleField = r.field === "purpose" || r.field === "type" || r.field === "any" ? r.field : "merchant";
    const rule: Rule = { id: r.id, category: r.category, field, patterns: r.patterns as string[] };
    if (r.sign === "debit" || r.sign === "credit") rule.sign = r.sign;
    return rule;
  });
}

function compile(rules: Rule[]): CompiledRule[] {
  return rules.map((r) => ({
    id: r.id,
    category: r.category,
    field: r.field,
    sign: r.sign,
    regexes: r.patterns.map((p) => new RegExp(p, "i")),
  }));
}

export function createRuleEngine(rules: Rule[] = loadRules()) {
  const compiled = compile(rules);
  return {
    rules,
    match(tx: Pick<Transaction, "counterparty" | "purpose" | "type" | "amount">, merchantKey?: string): RuleMatch | null {
      const merchant = merchantKey ?? merchantKeyFor(tx);
      const purpose = normalizeForRules(tx.purpose);
      const type = normalizeForRules(tx.type ?? "");
      for (const rule of compiled) {
        if (rule.sign === "debit" && tx.amount >= 0) continue;
        if (rule.sign === "credit" && tx.amount <= 0) continue;
        const targets =
          rule.field === "merchant" ? [merchant] : rule.field === "purpose" ? [purpose] : rule.field === "type" ? [type] : [merchant, purpose, type];
        for (const regex of rule.regexes) {
          if (targets.some((t) => t !== "" && regex.test(t))) {
            return { category: rule.category, ruleId: rule.id };
          }
        }
      }
      return null;
    },
  };
}

export type RuleEngine = ReturnType<typeof createRuleEngine>;

let defaultEngine: RuleEngine | null = null;

export function defaultRuleEngine(): RuleEngine {
  if (!defaultEngine) defaultEngine = createRuleEngine(loadRules());
  return defaultEngine;
}
