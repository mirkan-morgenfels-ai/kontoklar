"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import cpiJson from "../../../../../../data/k2/cpi.json";
import { categoryTotals, expenseAmountsByCategory, formatEur, formatPercent, monthlyBreakdown, monthsCovered } from "@/lib/kontoklar/analytics";
import { CATEGORY_TO_COICOP, COICOP_DIVISIONS, EXPENSE_CATEGORIES, type Category } from "@/lib/kontoklar/categories";
import {
  AXIS_TICK,
  CHART_COLORS,
  CHART_THEME,
  INCOME_LABEL,
  INCOME_STYLE,
  OTHER_LABEL,
  OTHER_STYLE,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_LABEL_STYLE,
  categoryColors,
  shownCategories,
  styleForCategory,
  type SeriesStyle,
} from "@/lib/kontoklar/chartTheme";
import { computePersonalInflation, displayWeights, type CpiData } from "@/lib/kontoklar/inflation";
import { detectRecurring, monthlyEquivalent, monthlyRecurringTotal, type Rhythm } from "@/lib/kontoklar/recurring";
import type { CategorizedTransaction } from "@/lib/kontoklar/types";
import { REPO_URL } from "@/lib/site";
import { SectionHeader } from "@/components/site/SectionHeader";
import { StatTile } from "@/components/site/StatTile";
import { ScrollRegion } from "./ScrollRegion";
import { Badge, Notice, Panel, Signed } from "./ui";

const cpi = cpiJson as CpiData;

const RHYTHM_LABEL: Record<Rhythm, string> = {
  monthly: "monatlich",
  quarterly: "vierteljährlich",
  semiannual: "halbjährlich",
  yearly: "jährlich",
};

const AXIS_NUMBER = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

function formatMonth(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function formatAxisEur(value: number): string {
  return `${AXIS_NUMBER.format(Math.round(value))} €`;
}

function axisTicks(max: number): number[] {
  if (!(max > 0)) return [0];
  const rough = max / 3;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 3, 4, 5, 6, 8, 10].find((factor) => factor * power >= rough) ?? 10) * power;
  return [0, step, 2 * step, 3 * step];
}

function barColor(style: SeriesStyle): string {
  return style.fill === OTHER_STYLE.fill ? style.stroke : style.fill;
}

interface LegendEntry {
  label: string;
  style: SeriesStyle;
  line?: boolean;
}

function SeriesMarker({ style, line }: { style: SeriesStyle; line?: boolean }) {
  if (line) {
    return (
      <span aria-hidden="true" className="relative inline-block h-2.5 w-5 shrink-0" data-marker="line">
        <span className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full" style={{ backgroundColor: style.stroke }} />
        <span
          className="absolute top-1/2 left-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px]"
          style={{ backgroundColor: style.fill, borderColor: style.stroke }}
          data-marker-dot="true"
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px] border"
      style={{ background: style.fill, borderColor: style.stroke }}
    />
  );
}

function ChartLegend({ entries }: { entries: LegendEntry[] }) {
  return (
    <ul aria-label="Legende" className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-ink" data-testid="chart-legend">
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center gap-2">
          <SeriesMarker style={entry.style} line={entry.line} />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

interface TooltipRow {
  key: string;
  value: number;
  style: SeriesStyle;
  line: boolean;
}

function ChartTooltip({
  active,
  payload,
  label,
  order,
  colors,
}: Pick<TooltipContentProps, "active" | "payload" | "label"> & { order: readonly string[]; colors: ReadonlyMap<Category, SeriesStyle> }) {
  if (!active || !payload || payload.length === 0) return null;
  const rows: TooltipRow[] = payload
    .map((entry) => {
      const key = String(entry.dataKey ?? entry.name ?? "");
      const style = key === INCOME_LABEL ? INCOME_STYLE : key === OTHER_LABEL ? OTHER_STYLE : styleForCategory(colors, key as Category);
      return { key, value: Number(entry.value ?? 0), style, line: key === INCOME_LABEL };
    })
    .filter((row) => order.includes(row.key) && (row.line || row.value !== 0))
    .sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return (
    <div style={TOOLTIP_CONTENT_STYLE}>
      <p style={TOOLTIP_LABEL_STYLE}>{label}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key} className={row.line ? "mt-1.5 flex items-center gap-2 border-t border-line pt-1.5" : "flex items-center gap-2"}>
            <SeriesMarker style={row.style} line={row.line} />
            <span className="whitespace-nowrap text-ink">
              {row.key}: <span className="num">{formatEur(row.value)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Dashboard({ items }: { items: CategorizedTransaction[] }) {
  const months = useMemo(() => monthlyBreakdown(items), [items]);
  const totals = useMemo(() => categoryTotals(items), [items]);
  const recurring = useMemo(
    () => detectRecurring(items.map((it) => ({ ...it, category: it.categorization.category }))),
    [items],
  );
  const inflation = useMemo(() => computePersonalInflation(cpi, expenseAmountsByCategory(items)), [items]);
  const inflationRows = useMemo(() => (inflation ? displayWeights(inflation.coveredWeights, inflation.personalRate) : []), [inflation]);
  const monthCount = monthsCovered(items);

  const totalExpenses = totals.reduce((s, t) => s + t.amount, 0);
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const shown = useMemo(() => shownCategories(totals), [totals]);
  const colors = useMemo(() => categoryColors(shown), [shown]);

  const chartData = months.map((m) => {
    const row: Record<string, number | string> = { month: m.month.slice(5) + "/" + m.month.slice(2, 4), [INCOME_LABEL]: m.income };
    for (const c of shown) row[c] = Math.round((m.byCategory[c] ?? 0) * 100) / 100;
    const rest = m.expenses - shown.reduce((s, c) => s + (m.byCategory[c] ?? 0), 0);
    row[OTHER_LABEL] = Math.max(0, Math.round(rest * 100) / 100);
    return row;
  });
  const showOther = chartData.some((row) => Number(row[OTHER_LABEL]) > 0);
  const legendEntries: LegendEntry[] = [
    ...shown.map((c) => ({ label: c, style: styleForCategory(colors, c) })),
    ...(showOther ? [{ label: OTHER_LABEL, style: OTHER_STYLE }] : []),
    { label: INCOME_LABEL, style: INCOME_STYLE, line: true },
  ];
  const tooltipOrder: string[] = [...(showOther ? [OTHER_LABEL] : []), ...[...shown].reverse(), INCOME_LABEL];
  const yTicks = axisTicks(Math.max(0, ...months.map((m) => Math.max(m.expenses, m.income))));

  const monthlyRecurring = monthlyRecurringTotal(recurring);
  const sample = cpi.sample === true;

  return (
    <section aria-labelledby="dashboard-title" className="mt-4 space-y-6 border-t border-line pt-12 sm:space-y-8 sm:pt-16" data-testid="dashboard">
      <SectionHeader
        id="dashboard-title"
        eyebrow="Auswertung"
        title="Dashboard"
        size="md"
        lead="Ausgaben, Einnahmen und wiederkehrende Zahlungen im hochgeladenen Zeitraum, dazu eine persönliche Inflationsrate."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Ausgaben gesamt" value={formatEur(totalExpenses)} hint={`${monthCount} Monat${monthCount === 1 ? "" : "e"}`} />
        <StatTile label="Ausgaben je Monat" value={formatEur(monthCount ? totalExpenses / monthCount : 0)} hint="ohne Umbuchungen" />
        <StatTile label="Einnahmen gesamt" value={formatEur(totalIncome)} tone="positive" />
        <StatTile
          label="Wiederkehrend je Monat"
          value={formatEur(monthlyRecurring)}
          hint={`${recurring.length} erkannte Zahlungen, anteilig je Monat`}
          tone={recurring.length > 0 ? "accent" : "muted"}
        />
      </div>

      <Panel eyebrow="Monatsverlauf" title="Ausgaben je Monat nach Kategorie" level={3}>
        <div
          className="h-72 w-full sm:h-80"
          role="img"
          aria-label={`Gestapeltes Balkendiagramm der Ausgaben je Monat nach Kategorie, ${months.length} Monate, Einnahmen als Linie mit Punkten darüber`}
          data-testid="monthly-chart"
          data-months={months.length}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%" accessibilityLayer={false}>
              <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
              <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: CHART_THEME.axisLine }} tickMargin={10} />
              <YAxis
                tick={AXIS_TICK}
                tickLine={false}
                axisLine={false}
                tickFormatter={formatAxisEur}
                ticks={yTicks}
                domain={[0, yTicks[yTicks.length - 1] ?? 0]}
                allowDecimals={false}
                width={60}
                tickMargin={6}
              />
              <Tooltip
                content={(props) => <ChartTooltip {...props} order={tooltipOrder} colors={colors} />}
                cursor={{ fill: CHART_THEME.cursor, fillOpacity: 0.55 }}
                isAnimationActive={false}
              />
              {shown.map((c) => {
                const style = styleForCategory(colors, c);
                return (
                  <Bar key={c} dataKey={c} stackId="a" fill={style.fill} stroke={CHART_THEME.segmentSeparator} strokeWidth={1} maxBarSize={44} isAnimationActive={false} />
                );
              })}
              {showOther && (
                <Bar dataKey={OTHER_LABEL} stackId="a" fill={OTHER_STYLE.fill} stroke={OTHER_STYLE.stroke} maxBarSize={44} isAnimationActive={false} />
              )}
              <Line
                dataKey={INCOME_LABEL}
                type="linear"
                stroke={INCOME_STYLE.stroke}
                strokeWidth={2}
                dot={{ r: 3.5, fill: INCOME_STYLE.fill, stroke: INCOME_STYLE.stroke, strokeWidth: 1.5 }}
                activeDot={{ r: 5, fill: INCOME_STYLE.stroke, stroke: CHART_COLORS.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ChartLegend entries={legendEntries} />
      </Panel>

      <Panel eyebrow="Verteilung" title="Ausgaben nach Kategorie" level={3}>
        <ul className="lg:columns-2 lg:gap-x-14" data-testid="category-list">
          {totals.map((t) => {
            const style = styleForCategory(colors, t.category);
            return (
              <li key={t.category} className="break-inside-avoid border-t border-line py-3">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex min-w-0 items-baseline gap-2.5 text-sm text-ink">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 shrink-0 translate-y-[1px] rounded-[3px] border"
                      style={{ background: style.fill, borderColor: style.stroke }}
                    />
                    <span className="min-w-0 break-words">
                      {t.category}
                      <span className="ml-1.5 text-xs text-slate">({t.count})</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
                    <span className="text-sm text-ink [font-variant-numeric:tabular-nums]">{formatEur(t.amount)}</span>
                    <span className="display num text-[1.0625rem] leading-none text-slate sm:w-12 sm:text-right sm:text-[1.25rem]">
                      {formatPercent(t.share, 0)}
                    </span>
                  </span>
                </div>
                <div aria-hidden="true" className="mt-2.5 h-1 overflow-hidden rounded-full" style={{ backgroundColor: CHART_COLORS.grid }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.round(t.share * 100)}%`, backgroundColor: barColor(style) }} />
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel eyebrow="Abos und Verträge" title="Wiederkehrende Zahlungen" level={3}>
        {recurring.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-5 py-8 text-center" data-testid="recurring-empty">
            <p className="mx-auto max-w-[60ch] text-sm leading-relaxed text-slate">
              Noch keine Muster gefunden. Nötig sind mindestens drei Buchungen im Abstand von etwa 30 Tagen (± 5) oder zwei
              im Abstand von etwa 91 Tagen (± 7, vierteljährlich), 182 Tagen (± 10, halbjährlich) oder einem Jahr (± 15),
              jeweils mit einem Betrag ± 5 %.
            </p>
          </div>
        ) : (
          <table className="data-table [&_td]:align-top [&_tbody_tr:first-child]:border-t-0 [&_tbody_tr:first-child_td]:pt-0" data-testid="recurring-table">
            <tbody>
              {recurring.map((r) => (
                <tr key={r.merchantKey}>
                  <td className="w-full pr-3 sm:pr-6">
                    <div className="font-medium wrap-anywhere hyphens-auto text-ink">{r.label}</div>
                    <div className="mt-0.5 text-xs text-slate">
                      {r.category ?? "–"} · {r.occurrences}× · <span className="whitespace-nowrap">{formatMonth(r.firstDate)}</span> bis{" "}
                      <span className="whitespace-nowrap">{formatMonth(r.lastDate)}</span>
                    </div>
                    <div className="mt-1.5 sm:hidden">
                      <Badge tone={r.rhythm === "monthly" ? "gold" : "stone"}>{RHYTHM_LABEL[r.rhythm]}</Badge>
                    </div>
                  </td>
                  <td className="hidden pr-6 sm:table-cell">
                    <Badge tone={r.rhythm === "monthly" ? "gold" : "stone"}>{RHYTHM_LABEL[r.rhythm]}</Badge>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <span className="font-medium text-ink">{formatEur(r.amount)}</span>
                    {r.rhythm !== "monthly" && <div className="mt-0.5 text-xs text-slate">{formatEur(monthlyEquivalent(r))} je Monat</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel eyebrow="Preise" title="Persönliche Inflation" level={3}>
        {sample && (
          <div className="mb-6">
            <Notice tone="warn">
              Die Teilindizes in dieser Vorschau sind Beispielwerte, keine Destatis-Daten. Echte Werte entstehen über den
              monatlichen Abruf (siehe{" "}
              <a href={`${REPO_URL}#readme`} rel="noopener noreferrer" className="link" data-testid="inflation-readme-link">
                README<span className="sr-only"> (externe Seite)</span>
              </a>
              ).
            </Notice>
          </div>
        )}
        {!inflation || inflationRows.length === 0 ? (
          <p className="text-sm text-slate">Keine Ausgaben mit COICOP-Zuordnung vorhanden.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-8">
            <div className="grid min-w-0 gap-px self-start overflow-hidden rounded-xl border border-line bg-line">
              <StatTile
                variant="ledger"
                label={sample ? "Persönliche Rate (Beispielrechnung)" : "Persönliche Rate"}
                value={formatPercent(inflation.personalRate, 2)}
                hint={`${formatMonth(inflation.fromPeriod)} → ${formatMonth(inflation.toPeriod)}`}
                tone={sample ? "neutral" : "negative"}
              />
              <StatTile
                variant="ledger"
                label={sample ? "Gesamtrate (Beispielwert)" : "Amtliche Gesamtrate"}
                value={inflation.officialRate === null ? "–" : formatPercent(inflation.officialRate, 2)}
                hint={sample ? "keine Destatis-Daten" : "Verbraucherpreisindex insgesamt"}
                tone={sample ? "muted" : "neutral"}
              />
              <StatTile
                variant="ledger"
                label="Abgedeckter Ausgabenanteil"
                value={formatPercent(inflation.coveredShare, 0)}
                hint="Bargeld und Kategorien ohne Indexwert sind nicht abgedeckt."
              />
            </div>
            <div className="min-w-0 self-start">
              <p id="inflation-caption" className="eyebrow mb-4">
                Teilindizes nach COICOP-Abteilung{sample ? " (Beispielwerte)" : ""}
              </p>
              <ScrollRegion label="Teilindizes nach COICOP-Abteilung" hintTestId="inflation-scroll-hint" testId="inflation-region">
                <table className="data-table" aria-labelledby="inflation-caption" data-testid="inflation-table">
                  <thead>
                    <tr>
                      <th className="pr-3 sm:pr-4">COICOP-Abteilung</th>
                      <th className="pr-3 text-right sm:pr-4">Anteil (abgedeckt)</th>
                      <th className="pr-3 text-right sm:pr-4">Veränderung zum Vorjahr</th>
                      <th className="text-right">Beitrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflationRows.map((w) => (
                      <tr key={w.division}>
                        <td className="min-w-44 pr-3 wrap-anywhere hyphens-auto sm:min-w-32 sm:pr-4">
                          <span className="num mr-1.5 text-xs text-slate">{w.division}</span>
                          {w.name}
                        </td>
                        <td className="pr-3 text-right whitespace-nowrap sm:pr-4">{formatPercent(w.share, 1)}</td>
                        <td className="pr-3 text-right whitespace-nowrap sm:pr-4">{w.change === null ? "–" : <Signed value={formatPercent(w.change, 2)} />}</td>
                        <td className="text-right whitespace-nowrap">
                          <Signed value={formatPercent(w.contribution, 2)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-ink font-medium" data-testid="inflation-sum">
                      <th scope="row" className="py-3 pr-3 text-left font-medium sm:pr-4">
                        Summe
                      </th>
                      <td className="py-3 pr-3 text-right whitespace-nowrap sm:pr-4">{formatPercent(inflationRows.reduce((s, w) => s + w.share, 0), 1)}</td>
                      <td className="py-3 pr-3 sm:pr-4" />
                      <td className="py-3 text-right whitespace-nowrap">
                        <Signed value={formatPercent(inflationRows.reduce((s, w) => s + w.contribution, 0), 2)} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </ScrollRegion>
              <p className="mt-4 max-w-[70ch] text-sm leading-relaxed text-ink" data-testid="inflation-covered">
                Abgedeckt: {formatPercent(inflation.coveredShare, 0)} Ihrer Ausgaben. Anteile und Beiträge beziehen sich auf die
                abgedeckten Ausgaben und sind so gerundet, dass sie zusammen 100 % und die persönliche Rate ergeben.
              </p>
            </div>
          </div>
        )}
        <div className="mt-6 border-t border-line pt-5">
          <p className="max-w-[70ch] text-xs leading-relaxed text-slate">
            Persönliche Rate = Summe (Anteil an den abgedeckten Ausgaben je Abteilung × Vorjahresveränderung). Verwendet wird
            die Vorjahresveränderung des letzten verfügbaren Monats; die Gewichte stammen aus dem hochgeladenen Zeitraum.{" "}
            {sample
              ? "Quelle: Beispielwerte, nicht Destatis."
              : "Quelle: Statistisches Bundesamt (Destatis), GENESIS-Online 61111-0002, Datenlizenz Deutschland – Namensnennung – Version 2.0."}
          </p>
        </div>
        <details className="group mt-5 text-sm">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2.5 rounded-xl border border-line px-4 py-2 font-medium text-ink transition-colors duration-150 hover:border-ink sm:rounded-full [&::-webkit-details-marker]:hidden">
            <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" className="h-2.5 w-2.5 text-gold-deep transition-transform duration-150 group-open:rotate-90">
              <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Zuordnung Kategorie → COICOP-Abteilung
          </summary>
          <div className="mt-5">
            <ScrollRegion label="Zuordnung Kategorie → COICOP-Abteilung" hintTestId="coicop-scroll-hint">
              <table className="data-table" data-testid="coicop-mapping">
                <thead>
                  <tr>
                    <th className="pr-3 sm:pr-4">Kategorie</th>
                    <th>COICOP-Abteilung</th>
                  </tr>
                </thead>
                <tbody>
                  {EXPENSE_CATEGORIES.map((c) => {
                    const division = CATEGORY_TO_COICOP[c];
                    return (
                      <tr key={c}>
                        <td className="py-2 pr-3 sm:pr-4">{c}</td>
                        <td className="py-2 wrap-anywhere hyphens-auto">{division ? `${division} ${COICOP_DIVISIONS[division] ?? ""}` : "nicht abgedeckt"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollRegion>
          </div>
          <p className="mt-3 max-w-[70ch] text-xs text-slate">
            Die Zuordnung ist eine Näherung; Online-Handel, Sonstiges und Gebühren & Zinsen laufen derzeit über Abteilung 12.
          </p>
        </details>
      </Panel>
    </section>
  );
}
