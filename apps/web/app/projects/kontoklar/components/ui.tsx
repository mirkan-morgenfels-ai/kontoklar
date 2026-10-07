import type { ReactNode } from "react";

export function Card({ title, children, aside }: { title?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border border-line bg-surface p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      {(title || aside) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="font-serif text-xl">{title}</h2>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ink" | "moss" | "wine" | "gold" | "stone";
}) {
  const color = { ink: "text-ink", moss: "text-moss", wine: "text-wine", gold: "text-gold-deep", stone: "text-stone" }[tone];
  return (
    <div className="rounded-lg border border-line bg-paper px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-stone">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-stone">{hint}</p>}
    </div>
  );
}

export function Badge({ children, tone = "stone" }: { children: ReactNode; tone?: "stone" | "moss" | "wine" | "gold" }) {
  const cls = {
    stone: "bg-paper text-stone border-line",
    moss: "bg-moss-soft text-moss border-moss/30",
    wine: "bg-wine-soft text-wine border-wine/30",
    gold: "bg-gold-soft text-ink border-gold/40",
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls = {
    primary: "bg-ink text-paper hover:bg-moss border-ink hover:border-moss",
    secondary: "bg-surface text-ink hover:border-gold border-line",
    ghost: "bg-transparent text-stone hover:text-ink border-transparent",
  }[variant];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-deep disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

export function Notice({ tone, children }: { tone: "info" | "warn" | "error" | "ok"; children: ReactNode }) {
  const cls = {
    info: "border-line bg-paper text-ink",
    warn: "border-gold/50 bg-gold-soft text-ink",
    error: "border-wine/40 bg-wine-soft text-wine",
    ok: "border-moss/40 bg-moss-soft text-moss",
  }[tone];
  const role = tone === "error" || tone === "warn" ? "alert" : "status";
  return (
    <div role={role} className={`rounded-md border px-3 py-2 text-sm ${cls}`}>
      {children}
    </div>
  );
}
