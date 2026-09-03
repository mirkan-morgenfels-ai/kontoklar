import { CATEGORY_TO_COICOP, COICOP_DIVISIONS, EXPENSE_CATEGORIES, type Category } from "./categories";

export interface CpiSeriesPoint {
  period: string;
  value: number;
}

export interface CpiData {
  source: string;
  license: string;
  baseYear: number;
  fetchedAt: string;
  sample: boolean;
  divisions: Record<string, { name: string; series: CpiSeriesPoint[] }>;
  total: { name: string; series: CpiSeriesPoint[] };
}

export interface CategoryShare {
  category: Category;
  amount: number;
  share: number;
}

export interface DivisionWeight {
  division: string;
  name: string;
  share: number;
  change: number | null;
  contribution: number;
}

export interface PersonalInflationResult {
  personalRate: number;
  officialRate: number | null;
  fromPeriod: string;
  toPeriod: string;
  coveredShare: number;
  weights: DivisionWeight[];
}

export function expenseShares(amountsByCategory: Partial<Record<Category, number>>): CategoryShare[] {
  const rows = EXPENSE_CATEGORIES.map((category) => ({ category, amount: Math.abs(amountsByCategory[category] ?? 0) })).filter((r) => r.amount > 0);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total === 0) return [];
  return rows.map((r) => ({ ...r, share: r.amount / total }));
}

export function sharesByDivision(shares: CategoryShare[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of shares) {
    const division = CATEGORY_TO_COICOP[s.category];
    if (!division) continue;
    map.set(division, (map.get(division) ?? 0) + s.share);
  }
  return map;
}

export function yearOverYearChange(series: CpiSeriesPoint[], toPeriod: string): { change: number; fromPeriod: string } | null {
  const to = series.find((p) => p.period === toPeriod);
  if (!to) return null;
  const year = Number(toPeriod.slice(0, 4));
  const fromPeriod = `${year - 1}${toPeriod.slice(4)}`;
  const from = series.find((p) => p.period === fromPeriod);
  if (!from || from.value === 0) return null;
  return { change: to.value / from.value - 1, fromPeriod };
}

export function personalInflationFromChanges(divisionShares: Map<string, number>, changes: Map<string, number>): { rate: number; covered: number } {
  let rate = 0;
  let covered = 0;
  for (const [division, share] of divisionShares) {
    const change = changes.get(division);
    if (change === undefined) continue;
    rate += share * change;
    covered += share;
  }
  if (covered === 0) return { rate: 0, covered: 0 };
  return { rate: rate / covered, covered };
}

export function latestCommonPeriod(cpi: CpiData): string | null {
  const periods = cpi.total.series.map((p) => p.period).sort();
  for (let i = periods.length - 1; i >= 0; i--) {
    const period = periods[i]!;
    if (yearOverYearChange(cpi.total.series, period)) return period;
  }
  return null;
}

export function computePersonalInflation(cpi: CpiData, amountsByCategory: Partial<Record<Category, number>>, toPeriod?: string): PersonalInflationResult | null {
  const period = toPeriod ?? latestCommonPeriod(cpi);
  if (!period) return null;
  const shares = expenseShares(amountsByCategory);
  const divisionShares = sharesByDivision(shares);
  const changes = new Map<string, number>();
  let fromPeriod = "";
  for (const division of divisionShares.keys()) {
    const series = cpi.divisions[division]?.series ?? [];
    const yoy = yearOverYearChange(series, period);
    if (yoy) {
      changes.set(division, yoy.change);
      fromPeriod = yoy.fromPeriod;
    }
  }
  const { rate, covered } = personalInflationFromChanges(divisionShares, changes);
  const official = yearOverYearChange(cpi.total.series, period);
  const weights: DivisionWeight[] = [...divisionShares.entries()]
    .map(([division, share]) => {
      const change = changes.get(division) ?? null;
      return {
        division,
        name: cpi.divisions[division]?.name ?? COICOP_DIVISIONS[division] ?? division,
        share,
        change,
        contribution: change === null ? 0 : share * change,
      };
    })
    .sort((a, b) => b.share - a.share);
  return {
    personalRate: rate,
    officialRate: official?.change ?? null,
    fromPeriod: fromPeriod || (official?.fromPeriod ?? ""),
    toPeriod: period,
    coveredShare: covered,
    weights,
  };
}
