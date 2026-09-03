import type { Category } from "./categories";
import type { CategorizedTransaction } from "./types";

export interface MonthRow {
  month: string;
  expenses: number;
  income: number;
  byCategory: Partial<Record<Category, number>>;
}

export interface CategoryTotal {
  category: Category;
  amount: number;
  share: number;
  count: number;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function isTransfer(category: Category): boolean {
  return category === "Umbuchung";
}

export function monthlyBreakdown(items: CategorizedTransaction[]): MonthRow[] {
  const map = new Map<string, MonthRow>();
  for (const it of items) {
    const cat = it.categorization.category;
    if (isTransfer(cat)) continue;
    const key = monthKey(it.bookingDate);
    const row = map.get(key) ?? { month: key, expenses: 0, income: 0, byCategory: {} };
    if (it.amount < 0) {
      row.expenses += -it.amount;
      row.byCategory[cat] = (row.byCategory[cat] ?? 0) + -it.amount;
    } else if (cat === "Einkommen") {
      row.income += it.amount;
    }
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, expenses: round2(r.expenses), income: round2(r.income) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function categoryTotals(items: CategorizedTransaction[]): CategoryTotal[] {
  const map = new Map<Category, { amount: number; count: number }>();
  let total = 0;
  for (const it of items) {
    const cat = it.categorization.category;
    if (it.amount >= 0 || isTransfer(cat)) continue;
    const entry = map.get(cat) ?? { amount: 0, count: 0 };
    entry.amount += -it.amount;
    entry.count += 1;
    total += -it.amount;
    map.set(cat, entry);
  }
  return [...map.entries()]
    .map(([category, e]) => ({ category, amount: round2(e.amount), count: e.count, share: total === 0 ? 0 : e.amount / total }))
    .sort((a, b) => b.amount - a.amount);
}

export function expenseAmountsByCategory(items: CategorizedTransaction[]): Partial<Record<Category, number>> {
  const out: Partial<Record<Category, number>> = {};
  for (const t of categoryTotals(items)) out[t.category] = t.amount;
  return out;
}

export function monthsCovered(items: CategorizedTransaction[]): number {
  const months = new Set(items.map((it) => monthKey(it.bookingDate)));
  return months.size;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n);
}

export function formatPercent(n: number, digits = 1): string {
  return new Intl.NumberFormat("de-DE", { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}
