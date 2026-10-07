"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/kontoklar/categories";
import type { CategorizedTransaction, CategorySource } from "@/lib/kontoklar/types";
import { formatEur } from "@/lib/kontoklar/analytics";
import { ScrollRegion } from "./ScrollRegion";
import { Badge, Button, Card } from "./ui";

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
  const [filter, setFilter] = useState<"review" | "all">("review");
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
    <Card
      title="2. Prüfen und korrigieren"
      aside={
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" aria-pressed={filter === "review"} onClick={() => setFilter("review")} className={`rounded-md px-2 py-1 ${filter === "review" ? "bg-ink text-paper" : "text-stone hover:text-ink"}`}>
            Zur Prüfung ({reviewCount})
          </button>
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={`rounded-md px-2 py-1 ${filter === "all" ? "bg-ink text-paper" : "text-stone hover:text-ink"}`}>
            Alle ({items.length})
          </button>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen …" aria-label="Buchungen durchsuchen" className="rounded-md border border-line bg-surface px-2 py-1 text-sm" />
        </div>
      }
    >
      {filtered.length === 0 ? (
        <p className="text-sm text-stone">{filter === "review" ? "Keine Buchung ist zur Prüfung markiert." : "Keine Treffer."}</p>
      ) : (
        <>
          <ScrollRegion label="Buchungen zur Prüfung" hintTestId="scroll-hint">
            <table className="w-full text-xs sm:min-w-[720px] sm:text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-stone">
                  <th className="hidden py-2 pr-3 sm:table-cell">Datum</th>
                  <th className="py-2 pr-2 sm:pr-3">Händler</th>
                  <th className="py-2 pr-2 text-right sm:pr-3">Betrag</th>
                  <th className="py-2 pr-2 sm:pr-3">Kategorie</th>
                  <th className="py-2 pr-2 sm:pr-3">Quelle</th>
                  <th className="py-2 pr-2 sm:pr-3">Konfidenz</th>
                  <th className="py-2">Verwendungszweck</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((it) => (
                  <tr key={it.id} className={`border-b border-line/70 align-top ${it.categorization.needsReview ? "bg-gold-soft/40" : ""}`}>
                    <td className="hidden whitespace-nowrap py-2 pr-3 tabular-nums text-stone sm:table-cell">{formatDate(it.bookingDate)}</td>
                    <td className="py-2 pr-2 sm:pr-3">
                      <div className="font-medium break-words hyphens-auto">{it.counterparty || <span className="text-stone">–</span>}</div>
                      <div className="tabular-nums text-stone sm:hidden">{formatDate(it.bookingDate)}</div>
                    </td>
                    <td className={`whitespace-nowrap py-2 pr-2 text-right tabular-nums sm:pr-3 ${it.amount < 0 ? "text-ink" : "text-moss"}`}>{formatEur(it.amount)}</td>
                    <td className="py-2 pr-2 sm:pr-3">
                      <select
                        value={it.categorization.category}
                        onChange={(e) => onChange(it.id, e.target.value as Category)}
                        className="w-full min-w-[7rem] max-w-[200px] rounded-md border border-line bg-surface px-2 py-1"
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
                          className="mt-1 block text-left text-xs text-stone underline decoration-dotted hover:text-ink"
                          title={`Für alle Buchungen mit Händler „${it.merchantKey}“ übernehmen`}
                        >
                          für alle „{it.merchantKey.slice(0, 24)}{it.merchantKey.length > 24 ? "…" : ""}“
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-2 sm:pr-3">
                      <Badge tone={sourceTone(it.categorization.source)}>{SOURCE_LABEL[it.categorization.source]}</Badge>
                    </td>
                    <td className="py-2 pr-2 tabular-nums sm:pr-3">
                      {it.categorization.source === "none" ? (
                        <span className="text-xs text-stone">
                          –<span className="sr-only"> keine automatische Zuordnung</span>
                        </span>
                      ) : (
                        <ConfidenceBar value={it.categorization.confidence} review={it.categorization.needsReview} />
                      )}
                    </td>
                    <td className="py-2">
                      <div className="max-w-md truncate text-xs text-stone" title={it.purpose}>
                        {it.purpose || "–"}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollRegion>
          {filtered.length > limit && (
            <div className="mt-3">
              <Button variant="secondary" onClick={() => setLimit(limit + 100)}>
                Weitere {Math.min(100, filtered.length - limit)} anzeigen
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function ConfidenceBar({ value, review }: { value: number; review: boolean }) {
  const pct = Math.round(value * 100);
  const color = review ? "bg-gold" : "bg-moss";
  return (
    <div className="flex items-center gap-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={review ? `Konfidenz ${pct} Prozent, zur Prüfung` : `Konfidenz ${pct} Prozent`}>
      <div className="h-1.5 w-16 overflow-hidden rounded bg-line" aria-hidden="true">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-stone">{pct} %</span>
    </div>
  );
}
