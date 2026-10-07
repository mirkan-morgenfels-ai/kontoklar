import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/components/site/cx";

export function Panel({
  title,
  eyebrow,
  aside,
  testId,
  className,
  level = 2,
  children,
}: {
  title?: string;
  eyebrow?: string;
  aside?: ReactNode;
  testId?: string;
  className?: string;
  level?: 2 | 3;
  children: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section className={cx("min-w-0 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-8", className)} data-testid={testId}>
      {(title || aside) && (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            {eyebrow ? <p className="eyebrow mb-2">{eyebrow}</p> : null}
            {title ? (
              <Heading className="display text-[1.625rem] leading-tight break-words hyphens-auto text-ink sm:text-[1.75rem]">{title}</Heading>
            ) : null}
          </div>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Signed({ value }: { value: string }) {
  if (!value.startsWith("-")) return <>{value}</>;
  return (
    <>
      <span className="[font-variant-numeric:lining-nums]">-</span>
      {value.slice(1)}
    </>
  );
}

type BadgeTone = "stone" | "moss" | "wine" | "gold";

const BADGE_TONE: Record<BadgeTone, string> = {
  stone: "border-line bg-surface text-slate",
  moss: "border-moss/30 bg-moss-soft/60 text-moss",
  wine: "border-wine/25 bg-wine-soft/60 text-wine",
  gold: "border-gold/60 bg-gold-soft/60 text-gold-deep",
};

export function Badge({ children, tone = "stone" }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", BADGE_TONE[tone])}>
      {children}
    </span>
  );
}

export type ButtonVariant = "primary" | "secondary" | "gold" | "outline-light";

const BUTTON_LOOK: Record<ButtonVariant, string> = {
  primary: "bg-navy-950 text-ivory hover:bg-navy-800",
  secondary: "border border-line-strong bg-surface text-ink hover:border-ink",
  gold: "bg-gold text-navy-950 hover:bg-gold-light",
  "outline-light": "border border-gold/70 text-ivory hover:border-gold-light hover:bg-navy-800",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-4 py-2 text-[0.8125rem]" : "px-5 py-2.5 text-sm",
        BUTTON_LOOK[variant],
        className,
      )}
      {...rest}
    />
  );
}

type NoticeTone = "info" | "warn" | "error" | "ok";

const NOTICE_TONE: Record<NoticeTone, string> = {
  info: "border-line bg-ivory/70 text-ink",
  warn: "border-gold/50 bg-gold-soft/50 text-ink",
  error: "border-wine/40 bg-wine-soft text-wine",
  ok: "border-moss/30 bg-moss-soft/60 text-moss",
};

const NOTICE_MARK: Record<NoticeTone, string> = {
  info: "bg-gold",
  warn: "bg-gold-deep",
  error: "bg-wine",
  ok: "bg-moss",
};

export function Notice({ tone, children }: { tone: NoticeTone; children: ReactNode }) {
  const role = tone === "error" || tone === "warn" ? "alert" : "status";
  return (
    <div role={role} className={cx("flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed", NOTICE_TONE[tone])}>
      <span aria-hidden="true" className={cx("mt-[0.55em] h-1.5 w-1.5 shrink-0 rotate-45", NOTICE_MARK[tone])} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
