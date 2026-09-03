"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import cpiJson from "../../../../../../data/k2/cpi.json";
import { categoryTotals, expenseAmountsByCategory, formatEur, formatPercent, monthlyBreakdown, monthsCovered } from "@/lib/kontoklar/analytics";
import { computePersonalInflation, type CpiData } from "@/lib/kontoklar/inflation";
import { detectRecurring } from "@/lib/kontoklar/recurring";
import type { CategorizedTransaction } from "@/lib/kontoklar/types";
import { Badge, Card, Notice, Stat } from "./ui";

const cpi = cpiJson as CpiData;

const PALETTE = ["#7a1f2b", "#b8912f", "#2f6b3a", "#111111", "#a3597f", "#d4b46a", "#5d8f66", "#6b6b66"];

export function Dashboard({ items }: { items: CategorizedTransaction[] }) {
  const months = useMemo(() => monthlyBreakdown(items), [items]);
  const totals = useMemo(() => categoryTotals(items), [items]);
  const recurring = useMemo(
    () => detectRecurring(items.map((it) => ({ ...it, category: it.categorization.category }))),
    [items],
  );
  const inflation = useMemo(() => computePersonalInflation(cpi, expenseAmountsByCategory(items)), [items]);
  const monthCount = monthsCovered(items);

  const totalExpenses = totals.reduce((s, t) => s + t.amount, 0);
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const topCategories = totals.slice(0, 6).map((t) => t.category);

  const chartData = months.map((m) => {
    const row: Record<string, number | string> = { month: m.month.slice(5) + "/" + m.month.slice(2, 4), Einnahmen: m.income };
    for (const c of topCategories) row[c] = Math.round((m.byCategory[c] ?? 0) * 100) / 100;
    const rest = m.expenses - topCategories.reduce((s, c) => s + (m.byCategory[c] ?? 0), 0);
    row["Übrige"] = Math.round(rest * 100) / 100;
    return row;
  });

  const monthlyRecurring = recurring.filter((r) => r.rhythm === "monatlich").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <Card title="3. Dashboard">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Ausgaben gesamt" value={formatEur(totalExpenses)} hint={`${monthCount} Monat${monthCount === 1 ? "" : "e"}`} tone="wine" />
          <Stat label="Ausgaben je Monat" value={formatEur(monthCount ? totalExpenses / monthCount : 0)} hint="ohne Umbuchungen" />
          <Stat label="Einnahmen gesamt" value={formatEur(totalIncome)} tone="moss" />
          <Stat label="Wiederkehrend je Monat" value={formatEur(monthlyRecurring)} hint={`${recurring.length} erkannte Zahlungen`} tone="gold" />
        </div>

        <div className="mt-6 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e3e0d6" vertical={false} />
              <XAxis dataKey="month" stroke="#6b6b66" fontSize={12} />
              <YAxis stroke="#6b6b66" fontSize={12} tickFormatter={(v: number) => `${Math.round(v)} €`} width={64} />
              <Tooltip formatter={(v) => formatEur(Number(v ?? 0))} contentStyle={{ borderColor: "#e3e0d6", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {topCategories.map((c, i) => (
                <Bar key={c} dataKey={c} stackId="a" fill={PALETTE[i % PALETTE.length]} />
              ))}
              <Bar dataKey="Übrige" stackId="a" fill="#cfcbbf" />
              <Bar dataKey="Einnahmen" fill="#2f6b3a" opacity={0.35} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Ausgaben nach Kategorie">
          <table className="w-full text-sm">
            <tbody>
              {totals.map((t, i) => (
                <tr key={t.category} className="border-b border-line/70">
                  <td className="py-2 pr-2">
                    <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: PALETTE[i % PALETTE.length] }} />
                    {t.category}
                    <span className="ml-1 text-xs text-stone">({t.count})</span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{formatEur(t.amount)}</td>
                  <td className="w-32 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-line">
                        <div className="h-full bg-wine" style={{ width: `${Math.round(t.share * 100)}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-stone">{formatPercent(t.share, 0)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Wiederkehrende Zahlungen">
          {recurring.length === 0 ? (
            <p className="text-sm text-stone">Noch keine Muster gefunden. Nötig sind mindestens drei Buchungen im Abstand von etwa 30 Tagen (± 5) oder zwei im Abstand von etwa einem Jahr (± 15), Betrag ± 5 %.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {recurring.map((r) => (
                  <tr key={r.merchantKey} className="border-b border-line/70">
                    <td className="py-2 pr-2">
                      <div className="font-medium">{r.label}</div>
                      <div className="text-xs text-stone">
                        {r.category ?? "–"} · {r.occurrences}× · {r.firstDate.slice(0, 7)} bis {r.lastDate.slice(0, 7)}
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <Badge tone={r.rhythm === "monatlich" ? "gold" : "stone"}>{r.rhythm === "monatlich" ? "monatlich" : "jährlich"}</Badge>
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatEur(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card title="Persönliche Inflation">
        {cpi.sample && (
          <div className="mb-3">
            <Notice tone="warn">Die Teilindizes in dieser Vorschau sind Beispielwerte, keine Destatis-Daten. Echte Werte entstehen über den monatlichen Abruf (siehe README).</Notice>
          </div>
        )}
        {!inflation || inflation.weights.length === 0 ? (
          <p className="text-sm text-stone">Keine Ausgaben mit COICOP-Zuordnung vorhanden.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
            <div className="grid gap-3">
              <Stat label="Persönliche Rate" value={formatPercent(inflation.personalRate, 2)} hint={`${inflation.fromPeriod} → ${inflation.toPeriod}`} tone="wine" />
              <Stat label="Amtliche Gesamtrate" value={inflation.officialRate === null ? "–" : formatPercent(inflation.officialRate, 2)} hint="Verbraucherpreisindex insgesamt" />
              <Stat label="Abgedeckter Ausgabenanteil" value={formatPercent(inflation.coveredShare, 0)} hint="Bargeld, Umbuchungen und Einkommen zählen nicht" />
            </div>
            <table className="w-full self-start text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-stone">
                  <th className="py-1 pr-2">COICOP-Abteilung</th>
                  <th className="py-1 pr-2 text-right">Eigener Anteil</th>
                  <th className="py-1 pr-2 text-right">Teilindex</th>
                  <th className="py-1 text-right">Beitrag</th>
                </tr>
              </thead>
              <tbody>
                {inflation.weights.map((w) => (
                  <tr key={w.division} className="border-b border-line/70">
                    <td className="py-1.5 pr-2">
                      <span className="mr-1 text-xs text-stone">{w.division}</span>
                      {w.name}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatPercent(w.share, 1)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{w.change === null ? "–" : formatPercent(w.change, 2)}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatPercent(w.contribution, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-stone">
          Persönliche Rate = Σ (eigener Ausgabenanteil je Abteilung × Vorjahresveränderung des Teilindex). Quelle der echten Daten: Statistisches Bundesamt (Destatis), GENESIS-Online 61111-0002, Datenlizenz Deutschland – Namensnennung – Version 2.0.
        </p>
      </Card>
    </div>
  );
}
