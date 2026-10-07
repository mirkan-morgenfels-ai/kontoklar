import { EXPENSE_CATEGORIES, type Category } from "./categories";

export const PALETTE = {
  ink: "#111111",
  paper: "#fbfaf6",
  surface: "#ffffff",
  gold: "#b8912f",
  goldDeep: "#7d5f17",
  goldSoft: "#f3e9c9",
  moss: "#2f6b3a",
  mossSoft: "#dfeadf",
  wine: "#7a1f2b",
  wineSoft: "#f1dcdf",
  stone: "#6b6b66",
  line: "#e3e0d6",
} as const;

export const EXPENSE_COLORS: readonly string[] = [PALETTE.wine, PALETTE.gold, PALETTE.ink, PALETTE.goldDeep, PALETTE.stone];

export const MAX_SHOWN_CATEGORIES = EXPENSE_COLORS.length;

export const OTHER_LABEL = "Übrige";
export const INCOME_LABEL = "Einnahmen";

export const CHART_THEME = {
  grid: PALETTE.line,
  axis: PALETTE.stone,
  text: PALETTE.ink,
  mutedText: PALETTE.stone,
  cursor: PALETTE.goldSoft,
  tooltipBorder: PALETTE.line,
  otherFill: PALETTE.line,
  otherStroke: PALETTE.stone,
  incomeFill: PALETTE.mossSoft,
  incomeStroke: PALETTE.moss,
  segmentSeparator: PALETTE.surface,
} as const;

export interface SeriesStyle {
  fill: string;
  stroke: string;
}

export function shownCategories(totals: readonly { category: Category; amount: number }[]): Category[] {
  const top = new Set(
    [...totals]
      .filter((t) => t.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, MAX_SHOWN_CATEGORIES)
      .map((t) => t.category),
  );
  return EXPENSE_CATEGORIES.filter((c) => top.has(c));
}

export function categoryColors(shown: readonly Category[]): Map<Category, SeriesStyle> {
  const ordered = EXPENSE_CATEGORIES.filter((c) => shown.includes(c)).slice(0, MAX_SHOWN_CATEGORIES);
  return new Map(ordered.map((c, i) => [c, { fill: EXPENSE_COLORS[i]!, stroke: EXPENSE_COLORS[i]! }]));
}

export function styleForCategory(colors: ReadonlyMap<Category, SeriesStyle>, category: Category): SeriesStyle {
  return colors.get(category) ?? { fill: CHART_THEME.otherFill, stroke: CHART_THEME.otherStroke };
}

export const INCOME_STYLE: SeriesStyle = { fill: CHART_THEME.incomeFill, stroke: CHART_THEME.incomeStroke };
export const OTHER_STYLE: SeriesStyle = { fill: CHART_THEME.otherFill, stroke: CHART_THEME.otherStroke };
