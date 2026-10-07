import type { ReactNode } from "react";
import { cx } from "./cx";

export interface SectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  level?: 2 | 3;
  size?: "lg" | "md";
  className?: string;
  aside?: ReactNode;
}

export function SectionHeader({ eyebrow, title, lead, id, level = 2, size = "lg", className, aside }: SectionHeaderProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <div className={cx("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl">
        <p className="eyebrow flex items-center gap-3">
          <span aria-hidden="true" className="h-px w-8 bg-gold" />
          {eyebrow}
        </p>
        <Heading
          id={id}
          className={cx(
            "display mt-4 text-ink",
            size === "lg" ? "text-[2.25rem] leading-[1.05] sm:text-[2.75rem]" : "text-[1.75rem] leading-[1.1] sm:text-[2rem]",
          )}
        >
          {title}
        </Heading>
        {lead ? <div className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-slate sm:text-base">{lead}</div> : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
