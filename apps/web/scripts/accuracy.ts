import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Transaction } from "@portfolio/csv";
import { evaluateAccuracy, overlapReport, UNASSIGNED_STAGE, type LabeledCase } from "../lib/kontoklar/accuracy";
import { isCategory } from "../lib/kontoklar/categories";
import { applyRules, collectApiTexts, mergeApiResults } from "../lib/kontoklar/categorize";
import { normalizeMerchant } from "../lib/kontoklar/merchant";
import { createOpenAiEmbed, createOpenAiFallback, loadLabeledVectors, openAiClient } from "../lib/kontoklar/providers";
import { categorizeTexts } from "../lib/kontoklar/server";

const root = path.resolve(__dirname, "..", "..", "..");
const testsetPath = path.join(root, "data", "k2", "testset.json");
const examplesPath = path.join(root, "data", "k2", "labeled-examples.json");
const outPath = path.join(root, "docs", "genauigkeit.json");

function loadTestset(): LabeledCase[] {
  const raw = JSON.parse(readFileSync(testsetPath, "utf-8")) as { cases: LabeledCase[] };
  return raw.cases.filter((c) => isCategory(c.label));
}

function loadExampleTexts(): string[] {
  const raw = JSON.parse(readFileSync(examplesPath, "utf-8")) as { examples: { text: string }[] };
  return raw.examples.map((e) => normalizeMerchant(e.text));
}

function toTransaction(c: LabeledCase, i: number): Transaction {
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

function pct(n: number, d: number): string {
  return d === 0 ? "–" : `${((100 * n) / d).toFixed(1)} %`;
}

async function main() {
  const withApi = process.argv.includes("--api");
  const write = process.argv.includes("--write");
  const cases = loadTestset();
  let items = applyRules(cases.map(toTransaction));

  const overlap = overlapReport(items, loadExampleTexts());
  const apiShare = `davon unter den ${overlap.apiTexts.length} Texten, die mit --api eingebettet würden: ${overlap.apiOverlapping.length}`;
  if (withApi && overlap.overlapping.length > 0) {
    console.error(
      `Abbruch: ${overlap.overlapping.length} von ${overlap.keys} Händlerschlüsseln des Testsets stehen wörtlich oder als Präfix im Beispielset (data/k2/labeled-examples.json), ${apiShare}. Die Sperre gilt bewusst für das ganze Testset: Vor einer Messung mit --api müssen Test- und Beispielset disjunkt sein.`,
    );
    process.exit(1);
  }
  console.log(`Überschneidung Testset/Beispielset: ${overlap.overlapping.length} von ${overlap.keys} Händlerschlüsseln (wörtlich oder als Präfix), ${apiShare}.`);

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

  const report = evaluateAccuracy(cases, items, {
    date: new Date().toISOString().slice(0, 10),
    mode: withApi ? "rule+knn+fallback" : "rule-only",
  });
  const { total, stages } = report;
  const assigned = total - (stages[UNASSIGNED_STAGE]?.count ?? 0);

  console.log(`\nTestset: ${total} Buchungen (${testsetPath})`);
  console.log(`Modus: ${withApi ? "Regel + Embedding-kNN + Fallback" : "nur Regel-Engine"}\n`);
  console.log("Stufe             Anteil     Accuracy (innerhalb Stufe)");
  for (const [name, s] of Object.entries(stages)) {
    console.log(`${name.padEnd(17)} ${pct(s.count, total).padStart(8)}   ${name === UNASSIGNED_STAGE ? "–" : pct(s.correct, s.count)}`);
  }
  console.log(`\nAccuracy gesamt (offene zählen als falsch): ${(100 * report.accuracyTotal).toFixed(1)} %`);
  console.log(`Accuracy auf zugeordneten Buchungen:           ${assigned === 0 ? "–" : `${(100 * report.accuracyAssigned).toFixed(1)} %`}`);

  console.log("\nPrecision / Recall je Kategorie (nur Kategorien im Testset):");
  for (const r of report.perCategory) {
    console.log(
      `${r.cat.padEnd(22)} n=${String(r.support).padStart(3)}  P=${r.precision === null ? "  –  " : (100 * r.precision).toFixed(0).padStart(3) + " %"}  R=${(100 * r.recall).toFixed(0).padStart(3)} %`,
    );
  }
  if (report.errors.length > 0) {
    console.log("\nFehler (Wahrheit -> Vorhersage, Händlertext):");
    for (const e of report.errors) {
      console.log(`  ${e.truth} -> ${e.predicted ?? "(offen)"}: ${e.counterparty || "(kein Empfänger)"}${e.ruleId ? ` [Regel ${e.ruleId}]` : ""}`);
    }
  }

  if (write) {
    writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
    console.log(`\nBericht geschrieben: ${outPath}`);
  } else {
    console.log("\nBericht nicht geschrieben (zum Aktualisieren von docs/genauigkeit.json: --write).");
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
