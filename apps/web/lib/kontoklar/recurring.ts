import type { Transaction } from "@portfolio/csv";
import type { Category } from "./categories";

export type Rhythm = "monatlich" | "jaehrlich";

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
  yearlyDays?: number;
  yearlyTolerance?: number;
  amountTolerance?: number;
  minOccurrences?: number;
}

const DEFAULTS: Required<RecurringOptions> = {
  monthlyDays: 30,
  monthlyTolerance: 5,
  yearlyDays: 365,
  yearlyTolerance: 15,
  amountTolerance: 0.05,
  minOccurrences: 3,
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

function findChain(items: Item[], rhythmDays: number, dayTolerance: number, amountTolerance: number, minOccurrences: number): Item[] | null {
  const sorted = [...items].sort((a, b) => a.bookingDate.localeCompare(b.bookingDate));
  const clusters: Item[][] = [];
  for (const it of sorted) {
    const cluster = clusters.find((c) => amountsSimilar(median(c.map((x) => x.amount)), it.amount, amountTolerance));
    if (cluster) cluster.push(it);
    else clusters.push([it]);
  }
  let best: Item[] | null = null;
  for (const cluster of clusters) {
    if (cluster.length < minOccurrences) continue;
    let chain: Item[] = [cluster[0]!];
    for (let i = 1; i < cluster.length; i++) {
      const prev = chain[chain.length - 1]!;
      const gap = daysBetween(prev.bookingDate, cluster[i]!.bookingDate);
      if (within(gap, rhythmDays, dayTolerance)) {
        chain.push(cluster[i]!);
      } else if (gap > rhythmDays + dayTolerance) {
        if (chain.length >= minOccurrences && (!best || chain.length > best.length)) best = chain;
        chain = [cluster[i]!];
      }
    }
    if (chain.length >= minOccurrences && (!best || chain.length > best.length)) best = chain;
  }
  return best;
}

export function detectRecurring(items: Item[], options: RecurringOptions = {}): RecurringPayment[] {
  const opt = { ...DEFAULTS, ...options };
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
    const monthly = findChain(list, opt.monthlyDays, opt.monthlyTolerance, opt.amountTolerance, opt.minOccurrences);
    const yearly = monthly ? null : findChain(list, opt.yearlyDays, opt.yearlyTolerance, opt.amountTolerance, 2);
    const chain = monthly ?? yearly;
    if (!chain) continue;
    const rhythm: Rhythm = monthly ? "monatlich" : "jaehrlich";
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
