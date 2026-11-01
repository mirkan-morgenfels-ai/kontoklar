import { PORTFOLIO_HOME_URL, PORTFOLIO_LABEL } from "@/lib/site";
import { Monogram } from "./Monogram";
import { cx } from "./cx";

export function Brand({ className }: { className?: string }) {
  return (
    <a
      href={PORTFOLIO_HOME_URL}
      rel="noopener noreferrer"
      className={cx("group -m-1.5 inline-flex items-center gap-3 rounded-lg p-1.5", className)}
      data-testid="portfolio-link"
    >
      <Monogram className="h-9 w-9 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5" />
      <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 sm:flex-col sm:items-start sm:gap-y-0">
        <span className="display text-[1.45rem] leading-none text-ivory">
          Mirkan <em className="text-gold-light italic">Deniz</em>
        </span>
        <span className="text-xs leading-none whitespace-nowrap text-navy-300 group-hover:text-ivory sm:mt-1.5">
          <span aria-hidden="true">← </span>
          {PORTFOLIO_LABEL}
        </span>
      </span>
      <span className="sr-only"> (externe Seite)</span>
    </a>
  );
}
