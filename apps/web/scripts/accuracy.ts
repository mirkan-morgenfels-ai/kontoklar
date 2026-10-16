import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Transaction } from "@portfolio/csv";
import {
  checkApiTestset,
  evaluateAccuracy,
  evaluateWithoutPurposeLabels,
  labelCounts,
  overlapReport,
  UNASSIGNED_STAGE,
  type AccuracyReport,
  type ApiTestsetIssue,
  type LabeledCase,
} from "../lib/kontoklar/accuracy";
import { isCategory } from "../lib/kontoklar/categories";
import { applyRules, collectApiTexts, mergeApiResults } from "../lib/kontoklar/categorize";
import { normalizeMerchant } from "../lib/kontoklar/merchant";
import { createOpenAiEmbed, createOpenAiFallback, loadLabeledVectors, openAiClient } from "../lib/kontoklar/providers";
import { categorizeTexts } from "../lib/kontoklar/server";

const root = path.resolve(__dirname, "..", "..", "..");
const testsetPath = path.join(root, "data", "k2", "testset.json");
const apiTestsetPath = path.join(root, "data", "k2", "testset-api.json");
const examplesPath = path.join(root, "data", "k2", "labeled-examples.json");
const outPath = path.join(root, "docs", "genauigkeit.json");
const apiOutPath = path.join(root, "docs", "genauigkeit-api.json");

function loadCases(file: string): LabeledCase[] {
  const raw = JSON.parse(readFileSync(file, "utf-8")) as { cases: LabeledCase[] };
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

const ISSUE_TEXT: Record<ApiTestsetIssue["kind"], string> = {
  "rule-hit": "Regeltreffer",
  "not-eligible": "nicht für die API zulässig",
  "empty-key": "leerer Händlerschlüssel",
  "duplicate-key": "doppelter Händlerschlüssel",
  "example-overlap": "wörtlich oder als Präfix im Beispielset",
};

function printIssues(issues: readonly ApiTestsetIssue[]) {
  for (const issue of issues) {
    console.error(`  Buchung ${issue.index} (${issue.counterparty || "(kein Empfänger)"}, ${issue.merchantKey || "–"}): ${ISSUE_TEXT[issue.kind]}: ${issue.detail}`);
  }
}

function printFigures(report: AccuracyReport) {
  const { total, stages } = report;
  const assigned = total - (stages[UNASSIGNED_STAGE]?.count ?? 0);
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
}

function printReport(report: AccuracyReport, file: string, modeText: string) {
  console.log(`\nTestset: ${report.total} Buchungen (${file})`);
  console.log(`Modus: ${modeText}\n`);
  printFigures(report);
  if (report.errors.length > 0) {
    console.log("\nFehler (Wahrheit -> Vorhersage, Händlertext):");
    for (const e of report.errors) {
      console.log(`  ${e.truth} -> ${e.predicted ?? "(offen)"}: ${e.counterparty || "(kein Empfänger)"}${e.ruleId ? ` [Regel ${e.ruleId}]` : ""}`);
    }
  }
}

function writeReport(file: string, content: unknown, write: boolean) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  if (write) {
    writeFileSync(file, JSON.stringify(content, null, 2) + "\n");
    console.log(`\nBericht geschrieben: ${file}`);
  } else {
    console.log(`\nBericht nicht geschrieben (zum Aktualisieren von ${relative}: --write).`);
  }
}

function apiTestset() {
  const cases = loadCases(apiTestsetPath);
  const items = applyRules(cases.map(toTransaction));
  return { cases, items };
}

function apiTestsetSummary(cases: readonly LabeledCase[], texts: number): string {
  const counts = [...labelCounts(cases).values()];
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const fromPurpose = cases.filter((c) => c.labelFromPurpose === true).length;
  return `${cases.length} Buchungen in ${counts.length} Kategorien (je ${min === max ? min : `${min} bis ${max}`}), ${texts} Händlertexte für die API, bei ${fromPurpose} folgt das Label nur aus dem Verwendungszweck (labelFromPurpose)`;
}

function measureRules(write: boolean) {
  const cases = loadCases(testsetPath);
  const items = applyRules(cases.map(toTransaction));
  const exampleTexts = loadExampleTexts();

  const overlap = overlapReport(items, exampleTexts);
  console.log(
    `Überschneidung Testset/Beispielset: ${overlap.overlapping.length} von ${overlap.keys} Händlerschlüsseln (wörtlich oder als Präfix), davon unter den ${overlap.apiTexts.length} Texten ohne Regeltreffer, die isApiEligible zulässt: ${overlap.apiOverlapping.length}. Die API-Stufe misst --api deshalb auf data/k2/testset-api.json.`,
  );

  const api = apiTestset();
  const issues = checkApiTestset(api.items, exampleTexts);
  if (issues.length === 0) {
    console.log(`API-Testset geprüft: ${apiTestsetSummary(api.cases, collectApiTexts(api.items).length)}; ohne Regeltreffer, alle zulässig, disjunkt zum Beispielset.`);
  } else {
    console.error(`API-Testset (data/k2/testset-api.json) nicht verwendbar, ${issues.length} Befunde:`);
    printIssues(issues);
  }

  const report = evaluateAccuracy(cases, items, { date: new Date().toISOString().slice(0, 10), mode: "rule-only" });
  printReport(report, testsetPath, "nur Regel-Engine");
  writeReport(outPath, report, write);

  const minimum = Number(process.env.KONTOKLAR_MIN_RULE_ACCURACY ?? "0");
  if (report.accuracyAssigned < minimum) {
    console.error(`Accuracy ${report.accuracyAssigned} unter Minimum ${minimum}`);
    process.exit(1);
  }
}

async function measureApi(write: boolean) {
  const { cases, items: ruled } = apiTestset();
  const exampleTexts = loadExampleTexts();
  const issues = checkApiTestset(ruled, exampleTexts);
  if (issues.length > 0) {
    console.error(`Abbruch: Das API-Testset (data/k2/testset-api.json) ist nicht verwendbar, ${issues.length} Befunde:`);
    printIssues(issues);
    process.exit(1);
  }
  const texts = collectApiTexts(ruled);
  console.log(`API-Testset geprüft: ${apiTestsetSummary(cases, texts.length)}; ohne Regeltreffer, alle zulässig, disjunkt zum Beispielset.`);

  const client = openAiClient();
  if (!client) {
    console.error("Abbruch: --api braucht OPENAI_API_KEY. Ohne Schlüssel misst das Skript die API-Stufe nicht; die Prüfung des API-Testsets oben ist davon unabhängig.");
    process.exit(1);
  }
  const labeled = await loadLabeledVectors();
  if (labeled.length === 0) {
    console.error("Abbruch: data/k2/labeled-embeddings.json fehlt oder ist leer. Zuerst pnpm --filter web embeddings:build ausführen.");
    process.exit(1);
  }
  const vectorIssues = checkApiTestset(ruled, [...exampleTexts, ...labeled.map((l) => l.text)]);
  if (vectorIssues.length > 0) {
    console.error(`Abbruch: Das API-Testset überschneidet sich mit den Texten in data/k2/labeled-embeddings.json, ${vectorIssues.length} Befunde:`);
    printIssues(vectorIssues);
    process.exit(1);
  }

  console.log(`API-Stufe: ${texts.length} Händlertexte werden eingebettet (nur normalisierte Händlerteile).`);
  const res = await categorizeTexts(texts, {
    cache: null,
    embed: createOpenAiEmbed(client),
    labeled,
    fallback: createOpenAiFallback(client),
  });
  console.log(`Eingebettet: ${res.stats.embedded}, an das Sprachmodell: ${res.stats.fallback}.`);
  const items = mergeApiResults(ruled, res.results);

  const options = { date: new Date().toISOString().slice(0, 10), mode: "rule+knn+fallback" as const };
  const report = evaluateAccuracy(cases, items, options);
  printReport(report, apiTestsetPath, "Regel + Embedding-kNN + Fallback (API-Testset, keine Buchung mit Regeltreffer)");
  const nameOnly = evaluateWithoutPurposeLabels(cases, items, options);
  console.log(`\nOhne die ${nameOnly.excluded.length} Buchungen, deren Label nur aus dem Verwendungszweck folgt (${nameOnly.excluded.join(", ")}): ${nameOnly.report.total} Buchungen\n`);
  printFigures(nameOnly.report);
  const { total, stages, accuracyTotal, accuracyAssigned, perCategory } = nameOnly.report;
  writeReport(
    apiOutPath,
    { testset: "data/k2/testset-api.json", ...report, withoutLabelFromPurpose: { excluded: nameOnly.excluded, total, stages, accuracyTotal, accuracyAssigned, perCategory } },
    write,
  );
}

async function main() {
  const write = process.argv.includes("--write");
  if (process.argv.includes("--api")) await measureApi(write);
  else measureRules(write);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
