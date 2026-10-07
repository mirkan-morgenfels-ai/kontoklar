import type { Transaction } from "@portfolio/csv";
import type { Category } from "./categories";

export type Rhythm = "monthly" | "quarterly" | "semiannual" | "yearly";

export const RHYTHM_MONTHS: Record<Rhythm, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

export interface RecurringPayment {
  merchantKey: string;
  label: string;
  rhythm: Rhythm;
  amount: number;
  occurrences: number;
  firstDate: string;
  lastDate: string;
  category: Category | null;
  transactionIds: string[];
}

export interface RecurringOptions {
  monthlyDays?: number;
  monthlyTolerance?: number;
  quarterlyDays?: number;
  quarterlyTolerance?: number;
  semiannualDays?: number;
  semiannualTolerance?: number;
  yearlyDays?: number;
  yearlyTolerance?: number;
  amountTolerance?: number;
  minOccurrences?: number;
  minOccurrencesLong?: number;
}

export const RECURRING_DEFAULTS: Required<RecurringOptions> = {
  monthlyDays: 30,
  monthlyTolerance: 5,
  quarterlyDays: 91,
  quarterlyTolerance: 7,
  semiannualDays: 182,
  semiannualTolerance: 10,
  yearlyDays: 365,
  yearlyTolerance: 15,
  amountTolerance: 0.05,
  minOccurrences: 3,
  minOccurrencesLong: 2,
};

interface Item extends Pick<Transaction, "id" | "bookingDate" | "amount" | "counterparty"> {
  merchantKey: string;
  category?: Category | null;
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b) - Date.parse(a);
  return Math.round(ms / 86_400_000);
}

function within(value: number, target: number, tolerance: number): boolean {
  return Math.abs(value - target) <= tolerance;
}

function amountsSimilar(a: number, b: number, tolerance: number): boolean {
  const ref = Math.max(Math.abs(a), Math.abs(b));
  if (ref === 0) return true;
  return Math.abs(Math.abs(a) - Math.abs(b)) / ref <= tolerance;
}

function median(values: number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length === 0) return 0;
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : (sorted[mid] ?? 0);
}

function hasNoOtherBookingsInBetween(all: Item[], chain: Item[]): boolean {
  const first = chain[0]!.bookingDate;
  const last = chain[chain.length - 1]!.bookingDate;
  return all.filter((it) => it.bookingDate >= first && it.bookingDate <= last).length === chain.length;
}

interface ChainRule {
  days: number;
  tolerance: number;
  minOccurrences: number;
  strict: boolean;
}

function findChain(items: Item[], rule: ChainRule, amountTolerance: number): Item[] | null {
  const sorted = [...items].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
  const clusters: Item[][] = [];
  for (const it of sorted) {
    const cluster = clusters.find((c) => amountsSimilar(median(c.map((x) => x.amount)), it.amount, amountTolerance));
    if (cluster) cluster.push(it);
    else clusters.push([it]);
  }
  let best: Item[] | null = null;
  for (const cluster of clusters) {
    if (cluster.length < rule.minOccurrences) continue;
    const consider = (chain: Item[]) => {
      if (chain.length < rule.minOccurrences) return;
      if (rule.strict && !hasNoOtherBookingsInBetween(sorted, chain)) return;
      if (!best || chain.length > best.length) best = chain;
    };
    let chain: Item[] = [cluster[0]!];
    for (let i = 1; i < cluster.length; i++) {
      const prev = chain[chain.length - 1]!;
      const gap = daysBetween(prev.bookingDate, cluster[i]!.bookingDate);
      if (within(gap, rule.days, rule.tolerance)) {
        chain.push(cluster[i]!);
      } else if (gap > rule.days + rule.tolerance) {
        consider(chain);
        chain = [cluster[i]!];
      }
    }
    consider(chain);
  }
  return best;
}

export function detectRecurring(items: Item[], options: RecurringOptions = {}): RecurringPayment[] {
  const opt = { ...RECURRING_DEFAULTS, ...options };
  const rules: [Rhythm, ChainRule][] = [
    ["monthly", { days: opt.monthlyDays, tolerance: opt.monthlyTolerance, minOccurrences: opt.minOccurrences, strict: false }],
    ["quarterly", { days: opt.quarterlyDays, tolerance: opt.quarterlyTolerance, minOccurrences: opt.minOccurrencesLong, strict: true }],
    ["semiannual", { days: opt.semiannualDays, tolerance: opt.semiannualTolerance, minOccurrences: opt.minOccurrencesLong, strict: true }],
    ["yearly", { days: opt.yearlyDays, tolerance: opt.yearlyTolerance, minOccurrences: opt.minOccurrencesLong, strict: false }],
  ];
  const groups = new Map<string, Item[]>();
  for (const it of items) {
    if (it.amount >= 0 || it.merchantKey === "") continue;
    const list = groups.get(it.merchantKey) ?? [];
    list.push(it);
    groups.set(it.merchantKey, list);
  }
  const result: RecurringPayment[] = [];
  for (const [merchantKey, list] of groups) {
    if (list.length < 2) continue;
    let found: { rhythm: Rhythm; chain: Item[] } | null = null;
    for (const [rhythm, rule] of rules) {
      const chain = findChain(list, rule, opt.amountTolerance);
      if (chain) {
        found = { rhythm, chain };
        break;
      }
    }
    if (!found) continue;
    const { rhythm, chain } = found;
    const amounts = chain.map((c) => Math.abs(c.amount));
    const sorted = [...chain].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
    result.push({
      merchantKey,
      label: sorted[sorted.length - 1]?.counterparty || merchantKey,
      rhythm,
      amount: Math.round(median(amounts) * 100) / 100,
      occurrences: chain.length,
      firstDate: sorted[0]!.bookingDate,
      lastDate: sorted[sorted.length - 1]!.bookingDate,
      category: chain[chain.length - 1]?.category ?? null,
      transactionIds: sorted.map((c) => c.id),
    });
  }
  return result.sort((a, b) => b.amount - a.amount);
}

export function monthlyEquivalent(payment: Pick<RecurringPayment, "amount" | "rhythm">): number {
  return Math.round((payment.amount / RHYTHM_MONTHS[payment.rhythm]) * 100) / 100;
}

export function monthlyRecurringTotal(payments: readonly Pick<RecurringPayment, "amount" | "rhythm">[]): number {
  const total = payments.reduce((s, p) => s + p.amount / RHYTHM_MONTHS[p.rhythm], 0);
  return Math.round(total * 100) / 100;
}
