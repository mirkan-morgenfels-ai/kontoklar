import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { PROJECTS } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  path: "/",
  title: "Projekte · Mirkan Deniz Günkaya",
  absoluteTitle: true,
  description:
    "Drei Projekte zu Finanzdaten, Textklassifikation und Netzwerkanalyse: DepotDoktor, KontoKlar und NetzRadar, jeweils mit öffentlichem Quellcode auf GitHub.",
});

const LINK_CLASS = "text-sm text-moss underline underline-offset-4 hover:text-gold-deep";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <p className="text-xs uppercase tracking-widest text-gold-deep">Portfolio</p>
        <h1 className="mt-2 font-serif text-4xl">Projekte</h1>
        <p className="mt-3 text-stone">
          Drei Projekte zu Finanzdaten, Textklassifikation und Netzwerkanalyse. Jedes läuft unter eigener Adresse, der
          Quellcode liegt öffentlich auf GitHub (MIT-Lizenz).
        </p>
      </section>
      <ul className="grid gap-6 md:grid-cols-3">
        {PROJECTS.map((project) => (
          <li key={project.slug} className="flex" data-testid={`project-${project.slug}`}>
            <article className="flex w-full flex-col rounded-xl border border-line bg-surface p-5">
              <p className="text-xs uppercase tracking-widest text-gold-deep">{project.kicker}</p>
              <h2 className="mt-1 font-serif text-xl">{project.title}</h2>
              <p className="mt-2 flex-1 text-sm text-stone">{project.description}</p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {project.external ? (
                  <a href={project.href} rel="noopener noreferrer" className={LINK_CLASS}>
                    Zum Projekt <span className="text-stone">(externe Seite)</span>
                    <span className="sr-only"> {project.title}</span>
                  </a>
                ) : (
                  <Link href={project.href} className={LINK_CLASS}>
                    Zum Projekt
                    <span className="sr-only"> {project.title}</span>
                  </Link>
                )}
                <a href={project.repo} rel="noopener noreferrer" className={LINK_CLASS}>
                  Quellcode <span className="text-stone">(externe Seite)</span>
                  <span className="sr-only"> von {project.title} auf GitHub</span>
                </a>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
