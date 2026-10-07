import type { ReactNode } from "react";
import { HeroBackdrop } from "./HeroBackdrop";
import { Shell } from "./Shell";

export interface StatusPageProps {
  code: string;
  eyebrow: string;
  title: string;
  text: string;
  actions: ReactNode;
}

export function StatusPage({ code, eyebrow, title, text, actions }: StatusPageProps) {
  return (
    <section className="surface-navy relative isolate flex flex-1 items-center overflow-hidden">
      <HeroBackdrop rule={false} />
      <Shell className="grid items-center gap-10 py-20 sm:py-28 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <span
            aria-hidden="true"
            className="display num mb-8 block text-[6.5rem] leading-[0.85] text-transparent select-none [-webkit-text-stroke:1px_rgb(216_189_114/0.6)] lg:hidden"
          >
            {code}
          </span>
          <p className="eyebrow flex items-center gap-3">
            <span aria-hidden="true" className="h-px w-8 bg-gold" />
            {eyebrow}
          </p>
          <h1 className="display mt-6 text-[clamp(2.6rem,6vw,4.25rem)] leading-[1.04] break-words hyphens-auto text-ivory">{title}</h1>
          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-navy-300 sm:text-[17px]">{text}</p>
          <div className="mt-10 flex flex-wrap items-center gap-3">{actions}</div>
        </div>
        <div aria-hidden="true" className="hidden select-none lg:col-span-5 lg:block">
          <span className="display num block text-right text-[13rem] leading-[0.9] text-transparent [-webkit-text-stroke:1px_rgb(216_189_114/0.6)]">
            {code}
          </span>
        </div>
      </Shell>
    </section>
  );
}
