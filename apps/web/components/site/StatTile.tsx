import type { ReactNode } from "react";
import { cx } from "./cx";
import { splitValueUnit } from "./value-unit";

export type StatTone = "neutral" | "positive" | "negative" | "accent" | "muted";

export interface StatTileProps {
  label: string;
  value: string;
  hint?: string | undefined;
  tone?: StatTone;
  variant?: "card" | "ledger";
  testId?: string | undefined;
  className?: string | undefined;
  children?: ReactNode;
}

const VALUE_TONE: Record<StatTone, string> = {
  neutral: "text-ink",
  positive: "text-moss",
  negative: "text-wine",
  accent: "text-gold-deep",
  muted: "text-slate",
};

const ACCENT_TONE: Record<StatTone, string> = {
  neutral: "before:bg-gold",
  positive: "before:bg-moss",
  negative: "before:bg-wine",
  accent: "before:bg-gold-deep",
  muted: "before:bg-line-strong",
};

const EMPTY_VALUES = new Set(["—", "–"]);

function TileValue({ value }: { value: string }) {
  const parts = splitValueUnit(value);
  if (!parts) return <>{value}</>;
  return (
    <>
      <span>{parts.number}</span>
      <span className="ml-[0.06em] align-[0.18em] font-sans text-[0.42em] font-medium tracking-normal">{parts.unit}</span>
    </>
  );
}

function valueSize(card: boolean, empty: boolean): string {
  if (card) return empty ? "mt-3 text-[1.75rem] sm:mt-4" : "mt-3 text-[2.125rem] sm:mt-4 sm:text-[2.375rem]";
  return "text-[1.5rem] sm:mt-3 sm:text-[1.875rem]";
}

export function StatTile({ label, value, hint, tone = "neutral", variant = "card", testId, className, children }: StatTileProps) {
  const card = variant === "card";
  const empty = EMPTY_VALUES.has(value.trim());
  return (
    <div
      className={cx(
        "relative min-w-0",
        card
          ? cx(
              "row-span-3 grid grid-rows-subgrid gap-y-0 rounded-2xl border border-line bg-surface p-5 shadow-card before:absolute before:top-0 before:left-5 before:h-0.5 before:w-10 before:content-[''] sm:p-6 sm:before:left-6",
              ACCENT_TONE[tone],
            )
          : "bg-surface px-5 py-5 max-sm:flex max-sm:flex-wrap max-sm:items-baseline max-sm:justify-between max-sm:gap-x-4 sm:row-span-3 sm:grid sm:grid-rows-subgrid sm:gap-y-0 sm:px-6",
        className,
      )}
      data-testid={testId ?? "stat-tile"}
    >
      <div className={cx("text-[0.6875rem] leading-snug font-medium tracking-[0.14em] text-slate uppercase", card ? "" : "max-sm:flex-1")}>
        {label}
      </div>
      <div
        className={cx(
          "font-display font-medium tracking-[-0.01em] leading-none [font-variant-numeric:lining-nums_tabular-nums]",
          valueSize(card, empty),
          empty ? "text-line-strong" : VALUE_TONE[tone],
        )}
        data-testid="stat-value"
      >
        <TileValue value={value} />
      </div>
      {hint || children ? (
        <div className={cx("text-xs leading-snug text-pretty text-slate", card ? "mt-3" : "max-sm:basis-full sm:mt-2")}>
          {hint}
          {children}
        </div>
      ) : null}
    </div>
  );
}
