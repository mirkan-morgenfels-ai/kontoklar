import type { Metadata } from "next";
import { HomeHero } from "@/components/site/HomeHero";
import { HeroOrnament } from "@/components/site/motif";
import { ProjectCards } from "@/components/site/ProjectCards";
import { SectionHeader } from "@/components/site/SectionHeader";
import { Shell } from "@/components/site/Shell";
import { pageMetadata } from "@/lib/metadata";
import { HOME_DESCRIPTION } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "Projekte · Mirkan Deniz Günkaya",
  absoluteTitle: true,
  description: HOME_DESCRIPTION,
});

export default function HomePage() {
  return (
    <>
      <HomeHero ornament={<HeroOrnament idPrefix="home-ornament" className="h-auto w-full" />} />
      <section id="projekte" aria-labelledby="projekte-title" className="scroll-mt-24 py-20 sm:py-24 lg:py-28">
        <Shell>
          <SectionHeader
            id="projekte-title"
            eyebrow="Übersicht"
            title="Projekte"
            lead="Jedes Projekt hat eine eigene Live-Adresse und ein eigenes öffentliches Repository. Hervorgehoben ist das Projekt, das auf dieser Website läuft."
          />
          <div className="mt-12 lg:mt-14">
            <ProjectCards />
          </div>
        </Shell>
      </section>
    </>
  );
}
