import { CATEGORIES, type Category } from "./categories";
import { collectApiTexts } from "./categorize";
import type { CategorizedTransaction } from "./types";

export interface LabeledCase {
  counterparty: string;
  purpose: string;
  type: string;
  amount: number;
  label: Category;
  labelFromPurpose?: boolean;
}

export interface StageStats {
  count: number;
  correct: number;
}

export interface CategoryScore {
  cat: Category;
  support: number;
  precision: number | null;
  recall: number;
}

export interface AccuracyError {
  counterparty: string;
  purpose: string;
  merchantKey: string;
  truth: Category;
  predicted: Category | null;
  source: string;
  ruleId: string | null;
}

export type AccuracyMode = "rule-only" | "rule+knn+fallback";

export interface AccuracyReport {
  date: string;
  mode: AccuracyMode;
  total: number;
  stages: Record<string, StageStats>;
  accuracyTotal: number;
  accuracyAssigned: number;
  perCategory: CategoryScore[];
  errors: AccuracyError[];
}

export const UNASSIGNED_STAGE = "unzugeordnet";

export function evaluateAccuracy(
  cases: readonly LabeledCase[],
  items: readonly CategorizedTransaction[],
  options: { date: string; mode: AccuracyMode },
): AccuracyReport {
  if (cases.length !== items.length) throw new Error("Testfälle und Ergebnisse haben unterschiedliche Länge");
  const stages: Record<string, StageStats> = {};
  const counts = new Map<Category, { tp: number; fp: number; fn: number }>(CATEGORIES.map((c) => [c, { tp: 0, fp: 0, fn: 0 }]));
  const errors: AccuracyError[] = [];

  items.forEach((it, i) => {
    const testCase = cases[i]!;
    const truth = testCase.label;
    const source = it.categorization.source;
    const assigned = source !== "none";
    const predicted = it.categorization.category;
    const stageName = assigned ? source : UNASSIGNED_STAGE;
    const stage = (stages[stageName] ??= { count: 0, correct: 0 });
    stage.count++;
    const correct = assigned && predicted === truth;
    if (correct) {
      stage.correct++;
      counts.get(truth)!.tp++;
      return;
    }
    counts.get(truth)!.fn++;
    if (assigned) counts.get(predicted)!.fp++;
    errors.push({
      counterparty: testCase.counterparty,
      purpose: testCase.purpose,
      merchantKey: it.merchantKey,
      truth,
      predicted: assigned ? predicted : null,
      source,
      ruleId: it.categorization.ruleId ?? null,
    });
  });

  const total = items.length;
  const correctTotal = Object.values(stages).reduce((s, x) => s + x.correct, 0);
  const assignedTotal = total - (stages[UNASSIGNED_STAGE]?.count ?? 0);
  const perCategory = [...counts.entries()]
    .filter(([, v]) => v.tp + v.fn > 0)
    .map(([cat, v]) => ({
      cat,
      support: v.tp + v.fn,
      precision: v.tp + v.fp === 0 ? null : v.tp / (v.tp + v.fp),
      recall: v.tp / (v.tp + v.fn),
    }))
    .sort((a, b) => b.support - a.support);

  return {
    date: options.date,
    mode: options.mode,
    total,
    stages,
    accuracyTotal: total === 0 ? 0 : correctTotal / total,
    accuracyAssigned: assignedTotal === 0 ? 0 : correctTotal / assignedTotal,
    perCategory,
    errors,
  };
}

export interface PurposeLabelSplit {
  excluded: string[];
  report: AccuracyReport;
}

export function evaluateWithoutPurposeLabels(
  cases: readonly LabeledCase[],
  items: readonly CategorizedTransaction[],
  options: { date: string; mode: AccuracyMode },
): PurposeLabelSplit {
  if (cases.length !== items.length) throw new Error("Testfälle und Ergebnisse haben unterschiedliche Länge");
  const keep = cases.map((c) => c.labelFromPurpose !== true);
  return {
    excluded: items.filter((_, i) => !keep[i]).map((it) => it.merchantKey),
    report: evaluateAccuracy(
      cases.filter((_, i) => keep[i]),
      items.filter((_, i) => keep[i]),
      options,
    ),
  };
}

export interface RuleEngineFigures {
  total: number;
  ruleCoverage: number;
  accuracyAssigned: number;
  accuracyTotal: number;
}

export function ruleEngineFigures(report: Pick<AccuracyReport, "total" | "stages" | "accuracyAssigned" | "accuracyTotal">): RuleEngineFigures {
  const ruleCount = report.stages.rule?.count ?? 0;
  return {
    total: report.total,
    ruleCoverage: report.total === 0 ? 0 : ruleCount / report.total,
    accuracyAssigned: report.accuracyAssigned,
    accuracyTotal: report.accuracyTotal,
  };
}

export function overlappingKeys(testKeys: readonly string[], exampleTexts: readonly string[]): string[] {
  const examples = exampleTexts.filter((e) => e !== "");
  return testKeys.filter((key) => key !== "" && examples.some((e) => e === key || e.startsWith(`${key} `)));
}

export function prefixOverlap(key: string, example: string): boolean {
  if (key === "" || example === "") return false;
  return key === example || example.startsWith(`${key} `) || key.startsWith(`${example} `);
}

export type ApiTestsetIssueKind = "rule-hit" | "not-eligible" | "empty-key" | "duplicate-key" | "example-overlap";

export interface ApiTestsetIssue {
  index: number;
  counterparty: string;
  merchantKey: string;
  kind: ApiTestsetIssueKind;
  detail: string;
}

export function checkApiTestset(items: readonly CategorizedTransaction[], exampleTexts: readonly string[]): ApiTestsetIssue[] {
  const examples = [...new Set(exampleTexts.filter((e) => e !== ""))];
  const firstIndex = new Map<string, number>();
  const issues: ApiTestsetIssue[] = [];
  items.forEach((it, index) => {
    const add = (kind: ApiTestsetIssueKind, detail: string) => issues.push({ index, counterparty: it.counterparty, merchantKey: it.merchantKey, kind, detail });
    if (it.categorization.source !== "none") add("rule-hit", it.categorization.ruleId ?? it.categorization.source);
    if (!it.apiEligible) add("not-eligible", "isApiEligible lässt die Buchung nicht zu");
    if (it.merchantKey === "") {
      add("empty-key", "leerer Händlerschlüssel");
      return;
    }
    const first = firstIndex.get(it.merchantKey);
    if (first === undefined) firstIndex.set(it.merchantKey, index);
    else add("duplicate-key", `wie Buchung ${first}`);
    for (const example of examples) {
      if (prefixOverlap(it.merchantKey, example)) add("example-overlap", example);
    }
  });
  return issues;
}

export function labelCounts(cases: readonly Pick<LabeledCase, "label">[]): Map<Category, number> {
  const counts = new Map<Category, number>();
  for (const c of cases) counts.set(c.label, (counts.get(c.label) ?? 0) + 1);
  return counts;
}

export interface OverlapReport {
  keys: number;
  overlapping: string[];
  apiTexts: string[];
  apiOverlapping: string[];
}

export function overlapReport(items: readonly CategorizedTransaction[], exampleTexts: readonly string[]): OverlapReport {
  const apiTexts = collectApiTexts(items);
  return {
    keys: items.length,
    overlapping: overlappingKeys(
      items.map((it) => it.merchantKey),
      exampleTexts,
    ),
    apiTexts,
    apiOverlapping: overlappingKeys(apiTexts, exampleTexts),
  };
}
