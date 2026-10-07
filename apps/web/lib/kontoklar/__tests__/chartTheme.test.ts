import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { EXPENSE_CATEGORIES } from "../categories";
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_THEME,
  EXPENSE_COLORS,
  INCOME_STYLE,
  MAX_SHOWN_CATEGORIES,
  OTHER_STYLE,
  PALETTE,
  SERIES_COLORS,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
  categoryColors,
  shownCategories,
  styleForCategory,
} from "../chartTheme";

const CSS = readFileSync(path.resolve(__dirname, "..", "..", "..", "app", "globals.css"), "utf-8");
const CSS_COLORS = new Set([...CSS.matchAll(/--color-[a-z0-9-]+:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]!.toLowerCase()));

function hsl(hex: string): { h: number; s: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s };
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const ALL_THEME_COLORS = [
  ...EXPENSE_COLORS,
  ...Object.values(CHART_THEME),
  INCOME_STYLE.fill,
  INCOME_STYLE.stroke,
  OTHER_STYLE.fill,
  OTHER_STYLE.stroke,
];

describe("chart theme", () => {
  test("palette hex values equal the tokens in globals.css", () => {
    expect(new Set(Object.values(PALETTE).map((c) => c.toLowerCase()))).toEqual(CSS_COLORS);
    expect(CSS_COLORS.size).toBe(22);
  });

  test("series colours follow the design order navy, gold, moss, wine, sky, slate, sand", () => {
    expect(SERIES_COLORS).toEqual(["#1d3a5f", "#b8912f", "#2f6b3a", "#7a1f2b", "#3e6a9e", "#5b6474", "#c9b98f"]);
    expect(CHART_COLORS).toMatchObject({ ink: PALETTE.ink, line: PALETTE.line, moss: PALETTE.moss, wine: PALETTE.wine, sky: PALETTE.sky, slate: PALETTE.slate });
  });

  test("every chart colour is a palette token or a chart colour", () => {
    const allowed = new Set([...Object.values(PALETTE), ...Object.values(CHART_COLORS)].map((c) => c.toLowerCase()));
    for (const color of ALL_THEME_COLORS) expect(allowed.has(color.toLowerCase()), color).toBe(true);
  });

  test("hand check of the hue helper: #7a1f2b is red (hue about 353°), #2f6b3a green (hue 130°)", () => {
    expect(hsl("#7a1f2b").h).toBeCloseTo(352.1, 0);
    expect(hsl("#2f6b3a").h).toBeCloseTo(131, 0);
    expect(hsl("#0000ff").h).toBe(240);
  });

  test("among the expense colours only navy and sky are blue (hue 180° to 260°, saturation above 15 %)", () => {
    const blue = EXPENSE_COLORS.filter((color) => {
      const { h, s } = hsl(color);
      return h >= 180 && h <= 260 && s > 0.15;
    });
    expect(blue).toEqual([CHART_COLORS.navy, CHART_COLORS.sky]);
  });

  test("moss is reserved for income and never used for an expense category", () => {
    expect(EXPENSE_COLORS).not.toContain(PALETTE.moss);
    expect(EXPENSE_COLORS).not.toContain(PALETTE.mossSoft);
    expect(INCOME_STYLE).toEqual({ fill: PALETTE.mossSoft, stroke: PALETTE.moss });
    expect(OTHER_STYLE).toEqual({ fill: CHART_COLORS.grid, stroke: CHART_COLORS.slate });
    expect(CHART_THEME.cursor).toBe(PALETTE.goldSoft);
  });

  test("expense colours are pairwise distinct, five at most, in series order without moss and slate", () => {
    expect(new Set(EXPENSE_COLORS).size).toBe(EXPENSE_COLORS.length);
    expect(MAX_SHOWN_CATEGORIES).toBe(5);
    expect(EXPENSE_COLORS).toEqual([CHART_COLORS.navy, CHART_COLORS.gold, CHART_COLORS.wine, CHART_COLORS.sky, CHART_COLORS.sand]);
    expect(EXPENSE_COLORS).toEqual(SERIES_COLORS.filter((c) => c !== CHART_COLORS.moss && c !== CHART_COLORS.slate));
  });

  test("hand check of the contrast helper: ink on white 17.3:1, gold on white 2.95:1, navy against sky 2.06:1", () => {
    expect(contrast(PALETTE.ink, "#ffffff")).toBeCloseTo(17.28, 1);
    expect(contrast(CHART_COLORS.gold, "#ffffff")).toBeCloseTo(2.95, 2);
    expect(contrast(CHART_COLORS.navy, CHART_COLORS.sky)).toBeCloseTo(2.06, 2);
  });

  test("neighbours in the stack are separated: the separator reaches 3:1 against at least one side of every pair", () => {
    expect(CHART_THEME.segmentSeparator).toBe(PALETTE.surface);
    for (let i = 0; i + 1 < EXPENSE_COLORS.length; i++) {
      const a = EXPENSE_COLORS[i]!;
      const b = EXPENSE_COLORS[i + 1]!;
      const best = Math.max(contrast(a, CHART_THEME.segmentSeparator), contrast(b, CHART_THEME.segmentSeparator));
      expect(best, `${a} | ${b}`).toBeGreaterThanOrEqual(3);
    }
  });

  test("sky and sand differ in lightness (2.88:1), where sky and slate were almost equal (1.07:1)", () => {
    expect(contrast(CHART_COLORS.sky, CHART_COLORS.sand)).toBeCloseTo(2.88, 2);
    expect(contrast(CHART_COLORS.sky, CHART_COLORS.slate)).toBeCloseTo(1.07, 2);
    expect(contrast(CHART_COLORS.wine, CHART_COLORS.sky)).toBeCloseTo(1.83, 2);
  });

  test("the neutral Übrige segment has a slate outline: 4.79:1 against its own fill, 3.07:1 against the sand neighbour", () => {
    expect(contrast(OTHER_STYLE.stroke, OTHER_STYLE.fill)).toBeCloseTo(4.79, 2);
    expect(contrast(OTHER_STYLE.stroke, CHART_COLORS.sand)).toBeCloseTo(3.07, 2);
    expect(contrast(OTHER_STYLE.fill, CHART_COLORS.sand)).toBeCloseTo(1.56, 2);
  });

  test("the separator itself stands out from every expense colour except gold (2.90:1) and sand (1.91:1)", () => {
    const below = EXPENSE_COLORS.filter((c) => contrast(c, CHART_THEME.segmentSeparator) < 3);
    expect(below).toEqual([CHART_COLORS.gold, CHART_COLORS.sand]);
    expect(contrast(CHART_COLORS.gold, PALETTE.surface)).toBeCloseTo(2.9, 2);
    expect(contrast(CHART_COLORS.sand, PALETTE.surface)).toBeCloseTo(1.91, 2);
  });

  test("axis, legend and tooltip text reach 4.5:1 on the card and on the white tooltip", () => {
    expect(contrast(CHART_THEME.axis, PALETTE.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(CHART_THEME.text, PALETTE.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOOLTIP_ITEM_STYLE.color, TOOLTIP_CONTENT_STYLE.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOOLTIP_LABEL_STYLE.color, TOOLTIP_CONTENT_STYLE.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    expect(AXIS_TICK.fill).toBe(CHART_THEME.axis);
  });
});

describe("colour assignment", () => {
  const totals = [
    { category: "Wohnen" as const, amount: 780 },
    { category: "Lebensmittel" as const, amount: 300 },
    { category: "Mobilität" as const, amount: 120 },
    { category: "Abos & Medien" as const, amount: 30 },
    { category: "Kleidung" as const, amount: 25 },
    { category: "Reisen" as const, amount: 10 },
  ];

  test("the five largest categories are shown in the fixed category order", () => {
    expect(shownCategories(totals)).toEqual(["Lebensmittel", "Wohnen", "Mobilität", "Abos & Medien", "Kleidung"]);
  });

  test("colours follow EXPENSE_CATEGORIES order: Lebensmittel navy, Wohnen gold, Mobilität wine, Abos sky, Kleidung sand", () => {
    const colors = categoryColors(shownCategories(totals));
    expect(colors.get("Lebensmittel")?.fill).toBe(CHART_COLORS.navy);
    expect(colors.get("Wohnen")?.fill).toBe(CHART_COLORS.gold);
    expect(colors.get("Mobilität")?.fill).toBe(CHART_COLORS.wine);
    expect(colors.get("Abos & Medien")?.fill).toBe(CHART_COLORS.sky);
    expect(colors.get("Kleidung")?.fill).toBe(CHART_COLORS.sand);
    expect(styleForCategory(colors, "Reisen")).toEqual(OTHER_STYLE);
  });

  test("a rank change inside the top five keeps every colour", () => {
    const before = categoryColors(shownCategories(totals));
    const reordered = totals.map((t) => (t.category === "Kleidung" ? { ...t, amount: 900 } : t.category === "Wohnen" ? { ...t, amount: 26 } : t));
    const after = categoryColors(shownCategories(reordered));
    expect([...after.entries()]).toEqual([...before.entries()]);
  });

  test("categories without spending are not shown", () => {
    expect(shownCategories([{ category: "Lebensmittel", amount: 0 }])).toEqual([]);
  });

  test("EXPENSE_CATEGORIES excludes income and transfers", () => {
    expect(EXPENSE_CATEGORIES).not.toContain("Einkommen");
    expect(EXPENSE_CATEGORIES).not.toContain("Umbuchung");
  });
});
