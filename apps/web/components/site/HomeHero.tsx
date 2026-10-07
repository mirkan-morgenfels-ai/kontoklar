import type { ReactNode } from "react";
import { GITHUB_PROFILE_URL, PROJECTS } from "@/lib/site";
import { ArrowMark, ExternalMark } from "./ExternalMark";
import { HeroBackdrop } from "./HeroBackdrop";
import { BUTTON_GOLD, BUTTON_OUTLINE_LIGHT } from "./buttons";
import { Shell } from "./Shell";

export function HomeHero({ ornament }: { ornament: ReactNode }) {
  return (
    <section className="surface-navy relative isolate overflow-hidden" aria-labelledby="home-title">
      <HeroBackdrop />
      <Shell className="pt-16 pb-16 sm:pt-20 lg:pt-24 lg:pb-20">
        <p className="eyebrow flex items-center gap-3">
          <span aria-hidden="true" className="h-px w-8 bg-gold" />
          Ausgewählte Projekte · 2026
        </p>
        <h1
          id="home-title"
          className="display mt-7 max-w-[17ch] text-[clamp(2.6rem,6.4vw,4.75rem)] leading-[1.03] text-balance text-ivory lg:max-w-none"
        >
          Drei Projekte zu Finanzdaten, <br className="hidden lg:inline" />
          <em className="text-gold-light">maschinellem Lernen</em> und Graph-ML
        </h1>
        <div className="mt-10 grid gap-12 lg:mt-14 lg:grid-cols-12 lg:gap-10">
          <div className="flex flex-col lg:col-span-5">
            <p className="max-w-[46ch] text-base leading-relaxed text-navy-300 sm:text-[17px]">
              Jedes Projekt läuft unter eigener Adresse, der Quellcode liegt öffentlich auf GitHub{" "}
              <span className="whitespace-nowrap">(MIT-Lizenz)</span>. Alle drei sind private, nicht-kommerzielle Portfolio-Projekte.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#projekte" className={BUTTON_GOLD}>
                Projekte ansehen
                <ArrowMark />
              </a>
              <a href={GITHUB_PROFILE_URL} rel="noopener noreferrer" className={BUTTON_OUTLINE_LIGHT}>
                GitHub-Profil<span className="sr-only"> (externe Seite)</span>
                <ExternalMark className="ml-2 h-2.5 w-2.5 text-gold-light" />
              </a>
            </div>
            <ol className="mt-12 grid grid-cols-3 gap-4 border-t border-navy-700 pt-5 lg:mt-auto" aria-label="Themen">
              {PROJECTS.map((project) => (
                <li key={project.slug}>
                  <span className="display num block text-[1.75rem] leading-none text-gold-light">{project.number}</span>
                  <span className="mt-2 block text-xs leading-snug text-navy-300">{project.topic}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="max-sm:hidden lg:col-span-7 lg:pl-8">{ornament}</div>
        </div>
      </Shell>
    </section>
  );
}
