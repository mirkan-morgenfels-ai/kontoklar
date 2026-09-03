import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { CATEGORIES, isCategory, type Category } from "../lib/kontoklar/categories";
import { applyRules, collectApiTexts, mergeApiResults } from "../lib/kontoklar/categorize";
import { categorizeTexts } from "../lib/kontoklar/server";
import { createOpenAiEmbed, createOpenAiFallback, loadLabeledVectors, openAiClient } from "../lib/kontoklar/providers";
import type { Transaction } from "@portfolio/csv";

interface TestCase {
  counterparty: string;
  purpose: string;
  type: string;
  amount: number;
  label: Category;
}

const root = path.resolve(__dirname, "..", "..", "..");
const testsetPath = path.join(root, "data", "k2", "testset.json");
const outPath = path.join(root, "docs", "genauigkeit.json");

function loadTestset(): TestCase[] {
  const raw = JSON.parse(readFileSync(testsetPath, "utf-8")) as { cases: TestCase[] };
  return raw.cases.filter((c) => isCategory(c.label));
}

function toTransaction(c: TestCase, i: number): Transaction {
  return {
    id: String(i),
    bookingDate: "2026-01-01",
    valueDate: null,
    counterparty: c.counterparty,
    purpose: c.purpose,
    amount: c.amount,
    currency: "EUR",
    type: c.type,
    bank: "generic",
  };
}

interface StageStats {
  count: number;
  correct: number;
}

function pct(n: number, d: number): string {
  return d === 0 ? "–" : `${((100 * n) / d).toFixed(1)} %`;
}

async function main() {
  const withApi = process.argv.includes("--api");
  const cases = loadTestset();
  const txs = cases.map(toTransaction);
  let items = applyRules(txs);

  if (withApi) {
    const client = openAiClient();
    if (!client) throw new Error("--api braucht OPENAI_API_KEY");
    const labeled = await loadLabeledVectors();
    const texts = collectApiTexts(items);
    console.log(`API-Stufe: ${texts.length} Händlertexte werden eingebettet (nur pseudonymisierte Händlerteile).`);
    const res = await categorizeTexts(texts, {
      cache: null,
      embed: labeled.length > 0 ? createOpenAiEmbed(client) : null,
      labeled,
      fallback: createOpenAiFallback(client),
    });
    items = mergeApiResults(items, res.results);
  }

  const stages: Record<string, StageStats> = {};
  const confusion = new Map<string, number>();
  const perCategory: Record<string, { tp: number; fp: number; fn: number }> = {};
  for (const c of CATEGORIES) perCategory[c] = { tp: 0, fp: 0, fn: 0 };

  items.forEach((it, i) => {
    const truth = cases[i]!.label;
    const source = it.categorization.source;
    const predicted = it.categorization.category;
    const stage = source === "none" ? "unzugeordnet" : source;
    const s = (stages[stage] ??= { count: 0, correct: 0 });
    s.count++;
    const correct = predicted === truth && source !== "none";
    if (correct) s.correct++;
    if (correct) perCategory[truth]!.tp++;
    else {
      perCategory[truth]!.fn++;
      if (source !== "none") perCategory[predicted]!.fp++;
      confusion.set(`${truth} -> ${source === "none" ? "(offen)" : predicted}`, (confusion.get(`${truth} -> ${source === "none" ? "(offen)" : predicted}`) ?? 0) + 1);
    }
  });

  const total = items.length;
  const correctTotal = Object.values(stages).reduce((s, x) => s + x.correct, 0);
  const assigned = total - (stages["unzugeordnet"]?.count ?? 0);

  console.log(`\nTestset: ${total} Buchungen (${testsetPath})`);
  console.log(`Modus: ${withApi ? "Regel + Embedding-kNN + Fallback" : "nur Regel-Engine"}\n`);
  console.log("Stufe             Anteil     Accuracy (innerhalb Stufe)");
  for (const [name, s] of Object.entries(stages)) {
    console.log(`${name.padEnd(17)} ${pct(s.count, total).padStart(8)}   ${name === "unzugeordnet" ? "–" : pct(s.correct, s.count)}`);
  }
  console.log(`\nAccuracy gesamt (offene zählen als falsch): ${pct(correctTotal, total)}`);
  console.log(`Accuracy auf zugeordneten Buchungen:           ${pct(correctTotal, assigned)}`);

  console.log("\nPrecision / Recall je Kategorie (nur Kategorien im Testset):");
  const rows = Object.entries(perCategory)
    .filter(([, v]) => v.tp + v.fn > 0)
    .map(([cat, v]) => ({ cat, support: v.tp + v.fn, precision: v.tp + v.fp === 0 ? null : v.tp / (v.tp + v.fp), recall: v.tp / (v.tp + v.fn) }))
    .sort((a, b) => b.support - a.support);
  for (const r of rows) {
    console.log(`${r.cat.padEnd(22)} n=${String(r.support).padStart(3)}  P=${r.precision === null ? "  –  " : (100 * r.precision).toFixed(0).padStart(3) + " %"}  R=${(100 * r.recall).toFixed(0).padStart(3)} %`);
  }
  if (confusion.size > 0) {
    console.log("\nFehler (Wahrheit -> Vorhersage):");
    for (const [k, v] of [...confusion.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${v}× ${k}`);
  }

  const report = {
    date: new Date().toISOString().slice(0, 10),
    mode: withApi ? "rule+knn+fallback" : "rule-only",
    total,
    stages,
    accuracyTotal: total === 0 ? 0 : correctTotal / total,
    accuracyAssigned: assigned === 0 ? 0 : correctTotal / assigned,
    perCategory: rows,
  };
  if (!withApi || !existsSync(outPath) || process.argv.includes("--write")) {
    writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
    console.log(`\nBericht geschrieben: ${outPath}`);
  }

  const minimum = Number(process.env.KONTOKLAR_MIN_RULE_ACCURACY ?? "0");
  if (report.accuracyAssigned < minimum) {
    console.error(`Accuracy ${report.accuracyAssigned} unter Minimum ${minimum}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
