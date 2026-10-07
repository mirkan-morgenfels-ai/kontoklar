import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { EXPENSE_CATEGORIES } from "../categories";
import {
  CHART_THEME,
  EXPENSE_COLORS,
  INCOME_STYLE,
  MAX_SHOWN_CATEGORIES,
  OTHER_STYLE,
  PALETTE,
  categoryColors,
  shownCategories,
  styleForCategory,
} from "../chartTheme";

const CSS = readFileSync(path.resolve(__dirname, "..", "..", "..", "app", "globals.css"), "utf-8");
const CSS_COLORS = new Set([...CSS.matchAll(/--color-[a-z-]+:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]!.toLowerCase()));

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
  ...Object.values(PALETTE),
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
  });

  test("every chart colour belongs to the project palette", () => {
    for (const color of ALL_THEME_COLORS) expect(CSS_COLORS.has(color.toLowerCase())).toBe(true);
  });

  test("hand check of the hue helper: #7a1f2b is red (hue about 353°), #2f6b3a green (hue 130°)", () => {
    expect(hsl("#7a1f2b").h).toBeCloseTo(352.1, 0);
    expect(hsl("#2f6b3a").h).toBeCloseTo(131, 0);
    expect(hsl("#0000ff").h).toBe(240);
  });

  test("no bluish colours: no hue between 180° and 260° with saturation above 15 %", () => {
    for (const color of ALL_THEME_COLORS) {
      const { h, s } = hsl(color);
      expect(h >= 180 && h <= 260 && s > 0.15, `${color} h=${h} s=${s}`).toBe(false);
    }
  });

  test("moss is reserved for income and never used for an expense category", () => {
    expect(EXPENSE_COLORS).not.toContain(PALETTE.moss);
    expect(EXPENSE_COLORS).not.toContain(PALETTE.mossSoft);
    expect(INCOME_STYLE).toEqual({ fill: PALETTE.mossSoft, stroke: PALETTE.moss });
    expect(OTHER_STYLE).toEqual({ fill: PALETTE.line, stroke: PALETTE.stone });
    expect(CHART_THEME.cursor).toBe(PALETTE.goldSoft);
  });

  test("expense colours are pairwise distinct, five at most", () => {
    expect(new Set(EXPENSE_COLORS).size).toBe(EXPENSE_COLORS.length);
    expect(MAX_SHOWN_CATEGORIES).toBe(5);
  });

  test("hand check of the contrast helper: ink on white 18.9:1, gold-deep against stone 1.11:1", () => {
    expect(contrast(PALETTE.ink, PALETTE.surface)).toBeCloseTo(18.88, 1);
    expect(contrast(PALETTE.goldDeep, PALETTE.stone)).toBeCloseTo(1.11, 2);
  });

  test("stacked segments are separated: between any two expense colours the separator has at least 3:1 against one side", () => {
    expect(CHART_THEME.segmentSeparator).toBe(PALETTE.surface);
    for (const a of EXPENSE_COLORS) {
      for (const b of EXPENSE_COLORS) {
        if (a === b) continue;
        const best = Math.max(contrast(a, CHART_THEME.segmentSeparator), contrast(b, CHART_THEME.segmentSeparator));
        expect(best, `${a} | ${b}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  test("the Übrige segment keeps its own stone outline with 4.05:1 against its fill", () => {
    expect(contrast(OTHER_STYLE.stroke, OTHER_STYLE.fill)).toBeCloseTo(4.05, 1);
    expect(contrast(OTHER_STYLE.stroke, OTHER_STYLE.fill)).toBeGreaterThanOrEqual(3);
  });

  test("the separator itself stands out from every expense colour except gold (2.95:1)", () => {
    const below = EXPENSE_COLORS.filter((c) => contrast(c, CHART_THEME.segmentSeparator) < 3);
    expect(below).toEqual([PALETTE.gold]);
    expect(contrast(PALETTE.gold, PALETTE.surface)).toBeCloseTo(2.95, 2);
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

  test("colours follow EXPENSE_CATEGORIES order: Lebensmittel wine, Wohnen gold, Mobilität ink, Abos gold-deep, Kleidung stone", () => {
    const colors = categoryColors(shownCategories(totals));
    expect(colors.get("Lebensmittel")?.fill).toBe(PALETTE.wine);
    expect(colors.get("Wohnen")?.fill).toBe(PALETTE.gold);
    expect(colors.get("Mobilität")?.fill).toBe(PALETTE.ink);
    expect(colors.get("Abos & Medien")?.fill).toBe(PALETTE.goldDeep);
    expect(colors.get("Kleidung")?.fill).toBe(PALETTE.stone);
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
