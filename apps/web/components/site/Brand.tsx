import Link from "next/link";
import { OWNER_NAME } from "@/lib/site";
import { BrandMark } from "./motif";
import { cx } from "./cx";

export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cx("group -m-1.5 inline-flex items-center gap-3 rounded-lg p-1.5", className)}>
      <BrandMark className="h-8 w-8 shrink-0 text-gold transition-transform duration-300 group-hover:rotate-45" />
      <span className="flex flex-col">
        <span className="display text-[1.3rem] leading-none tracking-[0.06em] text-ivory [font-variant-caps:all-small-caps]">
          {OWNER_NAME}
        </span>
        <span
          className={cx(
            "mt-1 text-[0.6875rem] leading-none font-medium tracking-[0.18em] text-navy-300 uppercase",
            compact ? "hidden sm:block" : null,
          )}
        >
          Portfolio · Daten, KI, Finanzen
        </span>
      </span>
    </Link>
  );
}
