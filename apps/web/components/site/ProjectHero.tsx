import type { ReactNode } from "react";
import { HeroBackdrop } from "./HeroBackdrop";
import { Shell } from "./Shell";

export interface HeroFact {
  value: string;
  label: string;
  detail: string;
}

export interface ProjectHeroProps {
  eyebrow: string;
  title: ReactNode;
  tagline?: ReactNode;
  lead: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
  facts: readonly HeroFact[];
  ornament?: ReactNode;
}

export function ProjectHero({ eyebrow, title, tagline, lead, actions, note, facts, ornament }: ProjectHeroProps) {
  return (
    <section className="surface-navy relative isolate overflow-hidden">
      <HeroBackdrop />
      <Shell className="grid gap-10 pt-10 pb-12 sm:gap-12 sm:pt-20 sm:pb-20 lg:grid-cols-12 lg:gap-14 lg:pt-24 lg:pb-24">
        <div className="lg:col-span-7">
          <p className="eyebrow flex items-center gap-3">
            <span aria-hidden="true" className="h-px w-8 bg-gold" />
            {eyebrow}
          </p>
          <h1 className="display mt-5 text-[clamp(3rem,7vw,4.75rem)] leading-[1.0] text-ivory sm:mt-6">{title}</h1>
          {tagline ? <p className="display mt-4 text-[1.5rem] leading-snug text-gold-light italic sm:text-[1.75rem]">{tagline}</p> : null}
          <div className="mt-6 max-w-[60ch] text-[15px] leading-relaxed text-navy-300 sm:mt-7 sm:text-[17px]">{lead}</div>
          {actions ? <div className="mt-8 flex flex-wrap items-center gap-3 sm:mt-9">{actions}</div> : null}
          {note ? <div className="mt-8 max-w-[34rem] sm:mt-10">{note}</div> : null}
        </div>
        <div className="lg:col-span-5 lg:pt-1">
          <div className="relative overflow-hidden rounded-2xl border border-navy-700 bg-navy-900/70 shadow-[0_24px_60px_rgb(0_0_0/0.25)] md:grid md:grid-cols-2 md:items-center lg:block">
            <div aria-hidden="true" className="absolute inset-x-6 top-0 h-px bg-linear-to-r from-gold/0 via-gold/70 to-gold/0" />
            {ornament ? (
              <div className="border-b border-navy-700 px-5 pt-7 pb-3 max-md:hidden md:h-full md:content-center md:border-r md:border-b-0 lg:h-auto lg:border-r-0 lg:border-b">
                {ornament}
              </div>
            ) : null}
            <dl className="grid grid-cols-3 divide-x divide-navy-700 sm:grid-cols-[max-content_1fr] sm:gap-x-6 sm:divide-x-0 sm:divide-y sm:px-7">
              {facts.map((fact) => (
                <div
                  key={fact.label}
                  className="flex flex-col-reverse justify-end gap-2 px-4 py-5 sm:col-span-2 sm:grid sm:grid-cols-subgrid sm:items-baseline sm:gap-y-0 sm:px-0 sm:py-4"
                >
                  <dt className="sm:col-start-2 sm:row-start-1">
                    <span className="block text-[13px] leading-snug font-medium text-ivory sm:text-sm">{fact.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-navy-300 max-sm:hidden">{fact.detail}</span>
                  </dt>
                  <dd className="display num text-[1.75rem] leading-none whitespace-nowrap text-gold-light sm:col-start-1 sm:row-start-1 sm:text-right sm:text-[2.25rem]">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </Shell>
    </section>
  );
}
