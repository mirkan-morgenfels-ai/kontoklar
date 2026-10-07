import { EXPENSE_CATEGORIES, type Category } from "./categories";

export const PALETTE = {
  navy950: "#0b1626",
  navy900: "#101f35",
  navy800: "#16273f",
  navy700: "#26354d",
  navy300: "#8f9bb0",
  ivory: "#f7f3ea",
  surface: "#fffdf8",
  line: "#e4ddcc",
  lineStrong: "#858d9b",
  ink: "#0f1b2d",
  slate: "#5b6474",
  gold: "#c9a548",
  goldLight: "#d8bd72",
  goldDeep: "#7d5f17",
  goldSoft: "#f3e9c9",
  moss: "#2f6b3a",
  mossLight: "#93c9a0",
  mossSoft: "#dfeadf",
  wine: "#7a1f2b",
  wineLight: "#e39aa4",
  wineSoft: "#f1dcdf",
  sky: "#3e6a9e",
} as const;

export const CHART_COLORS = {
  navy: "#1d3a5f",
  gold: "#b8912f",
  moss: "#2f6b3a",
  wine: "#7a1f2b",
  sky: "#3e6a9e",
  slate: "#5b6474",
  sand: "#c9b98f",
  ink: "#0f1b2d",
  line: "#e4ddcc",
  grid: "#ece6d8",
  surface: "#ffffff",
} as const;

export const SERIES_COLORS: readonly string[] = [
  CHART_COLORS.navy,
  CHART_COLORS.gold,
  CHART_COLORS.moss,
  CHART_COLORS.wine,
  CHART_COLORS.sky,
  CHART_COLORS.slate,
  CHART_COLORS.sand,
];

export const EXPENSE_COLORS: readonly string[] = [CHART_COLORS.navy, CHART_COLORS.gold, CHART_COLORS.wine, CHART_COLORS.sky, CHART_COLORS.sand];

export const MAX_SHOWN_CATEGORIES = EXPENSE_COLORS.length;

export const OTHER_LABEL = "Übrige";
export const INCOME_LABEL = "Einnahmen";

export const CHART_THEME = {
  grid: CHART_COLORS.grid,
  axis: CHART_COLORS.slate,
  axisLine: CHART_COLORS.line,
  text: CHART_COLORS.ink,
  mutedText: CHART_COLORS.slate,
  cursor: PALETTE.goldSoft,
  tooltipBackground: CHART_COLORS.surface,
  tooltipBorder: CHART_COLORS.line,
  otherFill: CHART_COLORS.grid,
  otherStroke: CHART_COLORS.slate,
  incomeFill: PALETTE.mossSoft,
  incomeStroke: PALETTE.moss,
  segmentSeparator: PALETTE.surface,
} as const;

export const AXIS_TICK = { fill: CHART_THEME.axis, fontSize: 12 } as const;

export const TOOLTIP_CONTENT_STYLE = {
  backgroundColor: CHART_THEME.tooltipBackground,
  border: `1px solid ${CHART_THEME.tooltipBorder}`,
  borderRadius: 12,
  boxShadow: "0 2px 6px rgb(11 22 38 / 0.06), 0 12px 32px rgb(11 22 38 / 0.12)",
  padding: "10px 14px",
  fontSize: 13,
  color: CHART_THEME.text,
} as const;

export const TOOLTIP_LABEL_STYLE = {
  color: CHART_THEME.mutedText,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 4,
} as const;

export const TOOLTIP_ITEM_STYLE = { color: CHART_THEME.text, padding: 0 } as const;

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
