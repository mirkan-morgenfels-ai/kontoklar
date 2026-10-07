"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import cpiJson from "../../../../../../data/k2/cpi.json";
import { categoryTotals, expenseAmountsByCategory, formatEur, formatPercent, monthlyBreakdown, monthsCovered } from "@/lib/kontoklar/analytics";
import { CATEGORY_TO_COICOP, COICOP_DIVISIONS, EXPENSE_CATEGORIES } from "@/lib/kontoklar/categories";
import { CHART_THEME, INCOME_LABEL, INCOME_STYLE, OTHER_LABEL, OTHER_STYLE, categoryColors, shownCategories, styleForCategory, type SeriesStyle } from "@/lib/kontoklar/chartTheme";
import { computePersonalInflation, displayWeights, type CpiData } from "@/lib/kontoklar/inflation";
import { detectRecurring, monthlyEquivalent, monthlyRecurringTotal, type Rhythm } from "@/lib/kontoklar/recurring";
import type { CategorizedTransaction } from "@/lib/kontoklar/types";
import { REPO_URL } from "@/lib/site";
import { ScrollRegion } from "./ScrollRegion";
import { Badge, Card, Notice, Stat } from "./ui";

const cpi = cpiJson as CpiData;

const RHYTHM_LABEL: Record<Rhythm, string> = {
  monthly: "monatlich",
  quarterly: "vierteljährlich",
  semiannual: "halbjährlich",
  yearly: "jährlich",
};

interface LegendEntry {
  label: string;
  style: SeriesStyle;
}

function ChartLegend({ entries }: { entries: LegendEntry[] }) {
  return (
    <ul aria-label="Legende" className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink" data-testid="chart-legend">
      {entries.map((entry) => (
        <li key={entry.label} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-sm border"
            style={{ background: entry.style.fill, borderColor: entry.style.stroke }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
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
    { label: INCOME_LABEL, style: INCOME_STYLE },
  ];

  const monthlyRecurring = monthlyRecurringTotal(recurring);
  const sample = cpi.sample === true;

  return (
    <div className="space-y-6">
      <Card title="3. Dashboard">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Ausgaben gesamt" value={formatEur(totalExpenses)} hint={`${monthCount} Monat${monthCount === 1 ? "" : "e"}`} tone="wine" />
          <Stat label="Ausgaben je Monat" value={formatEur(monthCount ? totalExpenses / monthCount : 0)} hint="ohne Umbuchungen" />
          <Stat label="Einnahmen gesamt" value={formatEur(totalIncome)} tone="moss" />
          <Stat
            label="Wiederkehrend je Monat"
            value={formatEur(monthlyRecurring)}
            hint={`${recurring.length} erkannte Zahlungen, anteilig je Monat`}
            tone="gold"
          />
        </div>

        <div className="mt-6 w-full">
          <div
            className="h-72 w-full"
            role="img"
            aria-label={`Gestapeltes Balkendiagramm der Ausgaben je Monat nach Kategorie, ${months.length} Monate, Einnahmen als separater, hell hinterlegter Balken`}
            data-testid="monthly-chart"
            data-months={months.length}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} accessibilityLayer={false}>
                <CartesianGrid stroke={CHART_THEME.grid} vertical={false} />
                <XAxis dataKey="month" stroke={CHART_THEME.axis} fontSize={12} />
                <YAxis stroke={CHART_THEME.axis} fontSize={12} tickFormatter={(v: number) => `${Math.round(v)} €`} width={64} />
                <Tooltip
                  formatter={(v) => formatEur(Number(v ?? 0))}
                  separator=": "
                  itemStyle={{ color: CHART_THEME.text }}
                  labelStyle={{ color: CHART_THEME.text }}
                  cursor={{ fill: CHART_THEME.cursor }}
                  contentStyle={{ borderColor: CHART_THEME.tooltipBorder, fontSize: 12 }}
                />
                {shown.map((c) => {
                  const style = styleForCategory(colors, c);
                  return <Bar key={c} dataKey={c} stackId="a" fill={style.fill} stroke={CHART_THEME.segmentSeparator} strokeWidth={1} />;
                })}
                {showOther && <Bar dataKey={OTHER_LABEL} stackId="a" fill={OTHER_STYLE.fill} stroke={OTHER_STYLE.stroke} />}
                <Bar dataKey={INCOME_LABEL} fill={INCOME_STYLE.fill} stroke={INCOME_STYLE.stroke} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ChartLegend entries={legendEntries} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ausgaben nach Kategorie">
          <table className="w-full text-sm">
            <tbody>
              {totals.map((t) => {
                const style = styleForCategory(colors, t.category);
                return (
                  <tr key={t.category} className="border-b border-line/70">
                    <td className="py-2 pr-2">
                      <span
                        aria-hidden="true"
                        className="mr-2 inline-block h-2.5 w-2.5 rounded-sm border align-middle"
                        style={{ background: style.fill, borderColor: style.stroke }}
                      />
                      {t.category}
                      <span className="ml-1 text-xs text-stone">({t.count})</span>
                    </td>
                    <td className="py-2 text-right tabular-nums sm:pr-2">
                      {formatEur(t.amount)}
                      <div className="text-xs text-stone sm:hidden">{formatPercent(t.share, 0)}</div>
                    </td>
                    <td className="hidden w-32 py-2 sm:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded bg-line">
                          <div className="h-full bg-wine" style={{ width: `${Math.round(t.share * 100)}%` }} />
                        </div>
                        <span className="w-10 text-right text-xs tabular-nums text-stone">{formatPercent(t.share, 0)}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title="Wiederkehrende Zahlungen">
          {recurring.length === 0 ? (
            <p className="text-sm text-stone">
              Noch keine Muster gefunden. Nötig sind mindestens drei Buchungen im Abstand von etwa 30 Tagen (± 5) oder zwei
              im Abstand von etwa 91 Tagen (± 7, vierteljährlich), 182 Tagen (± 10, halbjährlich) oder einem Jahr (± 15),
              jeweils mit einem Betrag ± 5 %.
            </p>
          ) : (
            <table className="w-full text-sm" data-testid="recurring-table">
              <tbody>
                {recurring.map((r) => (
                  <tr key={r.merchantKey} className="border-b border-line/70">
                    <td className="py-2 pr-2">
                      <div className="font-medium wrap-anywhere hyphens-auto">{r.label}</div>
                      <div className="text-xs text-stone">
                        {r.category ?? "–"} · {r.occurrences}× · <span className="whitespace-nowrap">{r.firstDate.slice(0, 7)}</span> bis{" "}
                        <span className="whitespace-nowrap">{r.lastDate.slice(0, 7)}</span>
                      </div>
                      <div className="mt-1 sm:hidden">
                        <Badge tone={r.rhythm === "monthly" ? "gold" : "stone"}>{RHYTHM_LABEL[r.rhythm]}</Badge>
                      </div>
                    </td>
                    <td className="hidden py-2 pr-2 sm:table-cell">
                      <Badge tone={r.rhythm === "monthly" ? "gold" : "stone"}>{RHYTHM_LABEL[r.rhythm]}</Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatEur(r.amount)}
                      {r.rhythm !== "monthly" && <div className="text-xs text-stone">{formatEur(monthlyEquivalent(r))} je Monat</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Persönliche Inflation">
        {sample && (
          <div className="mb-3">
            <Notice tone="warn">
              Die Teilindizes in dieser Vorschau sind Beispielwerte, keine Destatis-Daten. Echte Werte entstehen über den
              monatlichen Abruf (siehe{" "}
              <a
                href={`${REPO_URL}#readme`}
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-gold-deep"
                data-testid="inflation-readme-link"
              >
                README<span className="sr-only"> (externe Seite)</span>
              </a>
              ).
            </Notice>
          </div>
        )}
        {!inflation || inflationRows.length === 0 ? (
          <p className="text-sm text-stone">Keine Ausgaben mit COICOP-Zuordnung vorhanden.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="grid min-w-0 gap-3">
              <Stat
                label={sample ? "Persönliche Rate (Beispielrechnung)" : "Persönliche Rate"}
                value={formatPercent(inflation.personalRate, 2)}
                hint={`${inflation.fromPeriod} → ${inflation.toPeriod}`}
                tone={sample ? "stone" : "wine"}
              />
              <Stat
                label={sample ? "Gesamtrate (Beispielwert)" : "Amtliche Gesamtrate"}
                value={inflation.officialRate === null ? "–" : formatPercent(inflation.officialRate, 2)}
                hint={sample ? "keine Destatis-Daten" : "Verbraucherpreisindex insgesamt"}
                tone={sample ? "stone" : "ink"}
              />
              <Stat
                label="Abgedeckter Ausgabenanteil"
                value={formatPercent(inflation.coveredShare, 0)}
                hint="Bargeld und Kategorien ohne Indexwert sind nicht abgedeckt."
              />
            </div>
            <div className="min-w-0 self-start">
              <ScrollRegion label="Teilindizes nach COICOP-Abteilung" hintTestId="inflation-scroll-hint" testId="inflation-region">
                <table className="w-full text-sm" data-testid="inflation-table">
                  <caption className="mb-2 text-left text-xs uppercase tracking-wide text-stone">
                    Teilindizes nach COICOP-Abteilung{sample ? " (Beispielwerte)" : ""}
                  </caption>
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-stone">
                      <th className="py-1 pr-2">COICOP-Abteilung</th>
                      <th className="py-1 pr-2 text-right">Anteil (abgedeckt)</th>
                      <th className="py-1 pr-2 text-right">Veränderung zum Vorjahr</th>
                      <th className="py-1 text-right">Beitrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inflationRows.map((w) => (
                      <tr key={w.division} className="border-b border-line/70">
                        <td className="min-w-32 py-1.5 pr-2 wrap-anywhere hyphens-auto">
                          <span className="mr-1 text-xs text-stone">{w.division}</span>
                          {w.name}
                        </td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{formatPercent(w.share, 1)}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{w.change === null ? "–" : formatPercent(w.change, 2)}</td>
                        <td className="py-1.5 text-right tabular-nums">{formatPercent(w.contribution, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-medium" data-testid="inflation-sum">
                      <th scope="row" className="py-1.5 pr-2 text-left font-medium">
                        Summe
                      </th>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{formatPercent(inflationRows.reduce((s, w) => s + w.share, 0), 1)}</td>
                      <td className="py-1.5 pr-2" />
                      <td className="py-1.5 text-right tabular-nums">{formatPercent(inflationRows.reduce((s, w) => s + w.contribution, 0), 2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </ScrollRegion>
              <p className="mt-2 text-sm" data-testid="inflation-covered">
                Abgedeckt: {formatPercent(inflation.coveredShare, 0)} Ihrer Ausgaben. Anteile und Beiträge beziehen sich auf die
                abgedeckten Ausgaben und sind so gerundet, dass sie zusammen 100 % und die persönliche Rate ergeben.
              </p>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-stone">
          Persönliche Rate = Summe (Anteil an den abgedeckten Ausgaben je Abteilung × Vorjahresveränderung). Verwendet wird
          die Vorjahresveränderung des letzten verfügbaren Monats; die Gewichte stammen aus dem hochgeladenen Zeitraum.{" "}
          {sample
            ? "Quelle: Beispielwerte, nicht Destatis."
            : "Quelle: Statistisches Bundesamt (Destatis), GENESIS-Online 61111-0002, Datenlizenz Deutschland – Namensnennung – Version 2.0."}
        </p>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-stone hover:text-ink">Zuordnung Kategorie → COICOP-Abteilung</summary>
          <div className="mt-2">
            <ScrollRegion label="Zuordnung Kategorie → COICOP-Abteilung" hintTestId="coicop-scroll-hint">
              <table className="w-full text-sm" data-testid="coicop-mapping">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-stone">
                    <th className="py-1 pr-2">Kategorie</th>
                    <th className="py-1">COICOP-Abteilung</th>
                  </tr>
                </thead>
                <tbody>
                  {EXPENSE_CATEGORIES.map((c) => {
                    const division = CATEGORY_TO_COICOP[c];
                    return (
                      <tr key={c} className="border-b border-line/70">
                        <td className="py-1 pr-2">{c}</td>
                        <td className="py-1 wrap-anywhere hyphens-auto">{division ? `${division} ${COICOP_DIVISIONS[division] ?? ""}` : "nicht abgedeckt"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollRegion>
          </div>
          <p className="mt-2 text-xs text-stone">
            Die Zuordnung ist eine Näherung; Online-Handel, Sonstiges und Gebühren & Zinsen laufen derzeit über Abteilung 12.
          </p>
        </details>
      </Card>
    </div>
  );
}
