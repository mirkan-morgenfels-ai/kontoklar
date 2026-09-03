"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/kontoklar/categories";
import type { CategorizedTransaction, CategorySource } from "@/lib/kontoklar/types";
import { formatEur } from "@/lib/kontoklar/analytics";
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

  const reviewCount = items.filter((it) => it.categorization.needsReview).length;

  return (
    <Card
      title="2. Prüfen und korrigieren"
      aside={
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={() => setFilter("review")} className={`rounded-md px-2 py-1 ${filter === "review" ? "bg-ink text-white" : "text-stone hover:text-ink"}`}>
            Zur Prüfung ({reviewCount})
          </button>
          <button type="button" onClick={() => setFilter("all")} className={`rounded-md px-2 py-1 ${filter === "all" ? "bg-ink text-white" : "text-stone hover:text-ink"}`}>
            Alle ({items.length})
          </button>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen …" className="rounded-md border border-line px-2 py-1 text-sm" />
        </div>
      }
    >
      {filtered.length === 0 ? (
        <p className="text-sm text-stone">{filter === "review" ? "Nichts zu prüfen. Alle Buchungen sind sicher zugeordnet." : "Keine Treffer."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-stone">
                <th className="py-2 pr-3">Datum</th>
                <th className="py-2 pr-3">Empfänger / Zweck</th>
                <th className="py-2 pr-3 text-right">Betrag</th>
                <th className="py-2 pr-3">Kategorie</th>
                <th className="py-2 pr-3">Quelle</th>
                <th className="py-2">Konfidenz</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, limit).map((it) => (
                <tr key={it.id} className={`border-b border-line/70 align-top ${it.categorization.needsReview ? "bg-gold-soft/40" : ""}`}>
                  <td className="whitespace-nowrap py-2 pr-3 tabular-nums text-stone">{it.bookingDate.split("-").reverse().join(".")}</td>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{it.counterparty || <span className="text-stone">–</span>}</div>
                    <div className="max-w-md truncate text-xs text-stone" title={it.purpose}>
                      {it.purpose}
                    </div>
                  </td>
                  <td className={`whitespace-nowrap py-2 pr-3 text-right tabular-nums ${it.amount < 0 ? "text-ink" : "text-moss"}`}>{formatEur(it.amount)}</td>
                  <td className="py-2 pr-3">
                    <select
                      value={it.categorization.category}
                      onChange={(e) => onChange(it.id, e.target.value as Category)}
                      className="w-full max-w-[200px] rounded-md border border-line bg-white px-2 py-1"
                      aria-label="Kategorie"
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
                        className="mt-1 block text-xs text-stone underline decoration-dotted hover:text-ink"
                        title={`Für alle Buchungen mit Händler „${it.merchantKey}“ übernehmen`}
                      >
                        für alle „{it.merchantKey.slice(0, 24)}{it.merchantKey.length > 24 ? "…" : ""}“
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge tone={sourceTone(it.categorization.source)}>{SOURCE_LABEL[it.categorization.source]}</Badge>
                  </td>
                  <td className="py-2 tabular-nums">
                    <ConfidenceBar value={it.categorization.confidence} review={it.categorization.needsReview} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > limit && (
            <div className="mt-3">
              <Button variant="secondary" onClick={() => setLimit(limit + 100)}>
                Weitere {Math.min(100, filtered.length - limit)} anzeigen
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ConfidenceBar({ value, review }: { value: number; review: boolean }) {
  const pct = Math.round(value * 100);
  const color = review ? "bg-gold" : "bg-moss";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded bg-line">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-stone">{pct} %</span>
    </div>
  );
}
