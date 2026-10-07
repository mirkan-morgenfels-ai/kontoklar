"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/kontoklar/categories";
import type { CategorizedTransaction, CategorySource } from "@/lib/kontoklar/types";
import { formatEur } from "@/lib/kontoklar/analytics";
import { ScrollRegion } from "./ScrollRegion";
import { Badge, Button, Panel, Signed } from "./ui";

interface Props {
  items: CategorizedTransaction[];
  onChange: (id: string, category: Category) => void;
  onApplyToMerchant: (merchantKey: string, category: Category) => void;
}

const SOURCE_LABEL: Record<CategorySource, string> = {
  rule: "Regel",
  cache: "Cache",
  knn: "Embedding",
  llm: "Sprachmodell",
  manual: "Manuell",
  none: "Offen",
};

function sourceTone(source: CategorySource): "stone" | "moss" | "wine" | "gold" {
  if (source === "rule" || source === "manual") return "moss";
  if (source === "none") return "wine";
  return "gold";
}

function formatDate(isoDate: string): string {
  return isoDate.split("-").reverse().join(".");
}

function selectLabels(rows: readonly CategorizedTransaction[]): Map<string, string> {
  const seen = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const it of rows) {
    const base = `Kategorie für ${it.counterparty || it.merchantKey || "Buchung ohne Empfänger"}, ${formatDate(it.bookingDate)}, ${formatEur(it.amount)}`;
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    labels.set(it.id, count === 1 ? base : `${base} (Buchung ${count})`);
  }
  return labels;
}

export function ReviewTable({ items, onChange, onApplyToMerchant }: Props) {
  const [filter, setFilter] = useState<"review" | "all">(() => (items.some((it) => it.categorization.needsReview) ? "review" : "all"));
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(100);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (filter === "review" && !it.categorization.needsReview) return false;
      if (q && !`${it.counterparty} ${it.purpose} ${it.merchantKey}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filter, query]);

  const visible = filtered.slice(0, limit);
  const labels = useMemo(() => selectLabels(visible), [visible]);
  const reviewCount = items.filter((it) => it.categorization.needsReview).length;

  return (
    <Panel
      eyebrow="Prüfung"
      title="Prüfen und korrigieren"
      aside={
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <div role="group" aria-label="Filter" className="inline-flex rounded-full border border-line bg-surface p-1 shadow-[0_1px_2px_rgb(11_22_38/0.04)]">
            <button type="button" aria-pressed={filter === "review"} onClick={() => setFilter("review")} className={segmentClass(filter === "review")}>
              Zur Prüfung ({reviewCount})
            </button>
            <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={segmentClass(filter === "all")}>
              Alle ({items.length})
            </button>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen …"
            aria-label="Buchungen durchsuchen"
            className="field mt-0 w-full rounded-full px-4 py-2 sm:w-56"
          />
        </div>
      }
    >
      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-5 py-8 text-center text-sm text-slate">
          {filter === "review" ? "Keine Buchung ist zur Prüfung markiert." : "Keine Treffer."}
        </p>
      ) : (
        <>
          <ScrollRegion label="Buchungen zur Prüfung" hintTestId="scroll-hint">
            <table className="data-table text-xs sm:text-sm [&_td]:align-top">
              <thead>
                <tr>
                  <th className="hidden pr-4 sm:table-cell sm:pl-3">Datum</th>
                  <th className="pr-2.5 sm:pr-4">Händler</th>
                  <th className="pr-2.5 text-right sm:pr-4">Betrag</th>
                  <th className="sm:pr-4">Kategorie</th>
                  <th className="hidden pr-4 lg:table-cell">Quelle</th>
                  <th className="hidden pr-4 sm:table-cell">Konfidenz</th>
                  <th className="hidden pr-3 lg:table-cell">Verwendungszweck</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((it) => (
                  <tr key={it.id} className={it.categorization.needsReview ? "bg-gold-soft/35" : undefined}>
                    <td className="num hidden pr-4 whitespace-nowrap text-slate sm:table-cell sm:pl-3">{formatDate(it.bookingDate)}</td>
                    <td className="min-w-[6.5rem] pr-2.5 sm:min-w-[10rem] sm:pr-4 lg:min-w-[11rem]">
                      <div className="font-medium break-words text-ink">{it.counterparty || <span className="text-slate">–</span>}</div>
                      <div className="num text-slate sm:hidden">{formatDate(it.bookingDate)}</div>
                      <div className="mt-0.5 w-0 min-w-full truncate text-xs text-slate lg:hidden" title={it.purpose || undefined}>
                        {it.purpose || "–"}
                      </div>
                    </td>
                    <td className={`pr-2.5 text-right whitespace-nowrap sm:pr-4 ${it.amount < 0 ? "text-ink" : "text-moss"}`}>
                      <Signed value={formatEur(it.amount)} />
                    </td>
                    <td className="sm:pr-4">
                      <select
                        value={it.categorization.category}
                        onChange={(e) => onChange(it.id, e.target.value as Category)}
                        className="field mt-0 w-full max-w-[200px] min-w-[7rem] py-1.5 pr-7 pl-2.5 text-xs sm:text-[13px]"
                        aria-label={labels.get(it.id)}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      {it.merchantKey && it.categorization.source !== "rule" && (
                        <button
                          type="button"
                          onClick={() => onApplyToMerchant(it.merchantKey, it.categorization.category)}
                          className="mt-1.5 block w-0 min-w-full truncate text-left text-xs text-slate underline decoration-gold decoration-dotted underline-offset-2 hover:text-ink"
                          title={`Für alle Buchungen mit Händler „${it.merchantKey}“ übernehmen`}
                        >
                          für alle „{it.merchantKey.slice(0, 24)}{it.merchantKey.length > 24 ? "…" : ""}“
                        </button>
                      )}
                      <div className="mt-1.5 lg:hidden">
                        <Badge tone={sourceTone(it.categorization.source)}>{SOURCE_LABEL[it.categorization.source]}</Badge>
                      </div>
                    </td>
                    <td className="hidden pr-4 lg:table-cell">
                      <Badge tone={sourceTone(it.categorization.source)}>{SOURCE_LABEL[it.categorization.source]}</Badge>
                    </td>
                    <td className="hidden pr-4 sm:table-cell">
                      {it.categorization.source === "none" ? (
                        <span className="text-xs text-slate">
                          –<span className="sr-only"> keine automatische Zuordnung</span>
                        </span>
                      ) : (
                        <ConfidenceBar value={it.categorization.confidence} review={it.categorization.needsReview} />
                      )}
                    </td>
                    <td className="hidden pr-3 lg:table-cell">
                      <div className="max-w-[13rem] truncate text-xs text-slate" title={it.purpose}>
                        {it.purpose || "–"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
          {filtered.length > limit && (
            <div className="mt-5">
              <Button variant="secondary" onClick={() => setLimit(limit + 100)}>
                Weitere {Math.min(100, filtered.length - limit)} anzeigen
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function segmentClass(active: boolean): string {
  return active
    ? "rounded-full bg-navy-950 px-4 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap text-ivory shadow-[0_2px_8px_rgb(11_22_38/0.18)] transition-colors duration-150"
    : "rounded-full px-4 py-1.5 text-[0.8125rem] whitespace-nowrap text-slate transition-colors duration-150 hover:bg-ivory hover:text-ink";
}

function ConfidenceBar({ value, review }: { value: number; review: boolean }) {
  const pct = Math.round(value * 100);
  const color = review ? "bg-gold" : "bg-moss";
  return (
    <div className="flex items-center gap-2 pt-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={review ? `Konfidenz ${pct} Prozent, zur Prüfung` : `Konfidenz ${pct} Prozent`}>
      <div className="h-1 w-14 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="num text-xs text-slate">{pct} %</span>
    </div>
  );
}
