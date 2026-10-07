import { describe, expect, it } from "vitest";
import { splitValueUnit } from "@/components/site/value-unit";
import { formatEur, formatPercent } from "../kontoklar/analytics";

describe("splitValueUnit", () => {
  it("separates percent and euro units without changing the text", () => {
    for (const [value, number, unit] of [
      ["+2,40 %", "+2,40", " %"],
      ["−0,02 %", "−0,02", " %"],
      ["2,32 % p. a.", "2,32", " % p. a."],
      ["8.720,00 €", "8.720,00", " €"],
      ["179,20 €", "179,20", " €"],
    ] as const) {
      const parts = splitValueUnit(value);
      expect(parts).toEqual({ number, unit });
      expect(`${parts?.number}${parts?.unit}`).toBe(value);
    }
  });

  it("splits the KontoKlar formatters and joins them back byte for byte", () => {
    for (const value of [formatEur(10583.32), formatEur(-6.4), formatPercent(0.97, 0), formatPercent(0.0299, 2)]) {
      const parts = splitValueUnit(value);
      expect(parts, value).not.toBeNull();
      expect(`${parts?.number}${parts?.unit}`).toBe(value);
    }
    expect(splitValueUnit(formatEur(10583.32))?.number).toBe("10.583,32");
    expect(splitValueUnit(formatPercent(0.97, 0))?.number).toBe("97");
  });

  it("leaves values without a trailing unit untouched", () => {
    expect(splitValueUnit("–")).toBeNull();
    expect(splitValueUnit("—")).toBeNull();
    expect(splitValueUnit("12")).toBeNull();
    expect(splitValueUnit("% 12")).toBeNull();
  });
});
