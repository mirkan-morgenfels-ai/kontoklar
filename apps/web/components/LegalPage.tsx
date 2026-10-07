import type { ReactNode } from "react";
import { HeroBackdrop } from "@/components/site/HeroBackdrop";
import { LegalNav } from "@/components/site/LegalNav";
import { Shell } from "@/components/site/Shell";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <section className="surface-navy relative isolate overflow-hidden">
        <HeroBackdrop />
        <Shell className="pt-14 pb-12 sm:pt-20 sm:pb-16 lg:pt-24 lg:pb-20">
          <div className="lg:grid lg:grid-cols-12 lg:gap-10">
            <div className="lg:col-span-9 lg:col-start-4">
              <p className="eyebrow flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-gold" />
                Rechtliches
              </p>
              <h1 className="display mt-5 text-[clamp(2rem,9vw,4rem)] leading-[1.04] break-words hyphens-auto text-ivory">{title}</h1>
              <p className="mt-5 text-sm text-navy-300">Stand: {updated}</p>
            </div>
          </div>
        </Shell>
      </section>
      <Shell className="py-12 sm:py-16 lg:py-20">
        <div className="lg:grid lg:grid-cols-12 lg:gap-10">
          <aside className="mb-10 lg:col-span-3 lg:mb-0">
            <div className="lg:sticky lg:top-28">
              <p className="eyebrow mb-4 hidden lg:block">Rechtstexte</p>
              <LegalNav />
            </div>
          </aside>
          <article className="prose-legal max-w-[36rem] space-y-12 lg:col-span-9">{children}</article>
        </div>
      </Shell>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-t border-line pt-10 first:border-t-0 first:pt-0">
      <h2 className="display text-[1.75rem] leading-tight break-words hyphens-auto text-ink sm:text-[2rem]">{title}</h2>
      {children}
    </section>
  );
}
