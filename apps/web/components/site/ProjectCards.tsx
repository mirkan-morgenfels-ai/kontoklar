import Link from "next/link";
import { PROJECTS, type Project } from "@/lib/site";
import { ArrowMark, ExternalMark } from "./ExternalMark";
import { cx } from "./cx";

const PRIMARY_LINK =
  "inline-flex items-center text-sm font-medium text-gold-light transition-colors duration-150 hover:text-ivory";
const SECONDARY_LINK = "inline-flex items-center text-sm text-ivory/85 transition-colors duration-150 hover:text-gold-light";

function ProjectGlyph({ slug }: { slug: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.25, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  return (
    <svg viewBox="0 0 80 44" aria-hidden="true" focusable="false" className="h-11 w-20 text-gold-light/75">
      <path d="M2 42.5h76" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="2 4" />
      {slug === "depotdoktor" ? (
        <>
          <path d="M4 34 13 29 19 32 28 23 34 26 44 16 50 19 60 10 66 12 74 5" {...common} />
          <circle cx="74" cy="5" r="2.25" fill="currentColor" />
        </>
      ) : null}
      {slug === "kontoklar" ? (
        <>
          {[
            [6, 26],
            [20, 14],
            [34, 30],
            [48, 8],
            [62, 20],
          ].map(([x, y]) => (
            <rect key={x} x={x} y={y} width="9" height={40 - (y ?? 0)} rx="1.5" {...common} />
          ))}
        </>
      ) : null}
      {slug === "netzradar" ? (
        <>
          <path d="M8 30 24 12 42 24 58 8 72 28 42 24 30 38 8 30M24 12 30 38M58 8 72 28" {...common} strokeOpacity="0.7" />
          {[
            [8, 30],
            [24, 12],
            [30, 38],
            [58, 8],
            [72, 28],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="2.25" fill="#0b1626" stroke="currentColor" strokeWidth="1.25" />
          ))}
          <circle cx="42" cy="24" r="2.75" fill="currentColor" />
          <circle cx="42" cy="24" r="6" fill="none" stroke="currentColor" strokeWidth="1" strokeOpacity="0.6" />
        </>
      ) : null}
    </svg>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const current = !project.external;
  return (
    <article
      className={cx(
        "surface-navy relative flex w-full flex-col overflow-hidden rounded-2xl border p-7 sm:p-8",
        current ? "border-gold/60 bg-navy-950 shadow-float" : "border-navy-700 bg-navy-900",
      )}
    >
      {current ? (
        <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-linear-to-r from-gold via-gold-light to-gold" />
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <span aria-hidden="true" className="display num text-[3.25rem] leading-[0.8] text-gold-light">
          {project.number}
        </span>
        <ProjectGlyph slug={project.slug} />
      </div>
      <div className="mt-10 flex min-h-6 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="eyebrow">{project.topic}</p>
        {current ? (
          <span className="rounded-full border border-gold/70 px-2.5 py-0.5 text-[0.6875rem] leading-5 font-medium tracking-[0.14em] text-gold-light uppercase">
            Diese Website
          </span>
        ) : null}
      </div>
      <h3 className="display mt-2 text-[2rem] leading-[1.1] text-ivory">{project.title}</h3>
      <p className="mt-3 max-w-[52ch] flex-1 text-[15px] leading-relaxed text-navy-300">{project.description}</p>
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 border-t border-navy-700 pt-5">
        {project.external ? (
          <a href={project.href} rel="noopener noreferrer" className={PRIMARY_LINK}>
            Live ansehen<span className="sr-only"> {project.title} (externe Seite)</span>
            <ExternalMark className="ml-1.5 h-2.5 w-2.5" />
          </a>
        ) : (
          <Link href={project.href} className={PRIMARY_LINK}>
            Live ansehen<span className="sr-only"> {project.title}</span>
            <ArrowMark />
          </Link>
        )}
        <a href={project.repo} rel="noopener noreferrer" className={SECONDARY_LINK}>
          Quellcode<span className="sr-only"> von {project.title} auf GitHub (externe Seite)</span>
          <ExternalMark className="ml-1.5 h-2.5 w-2.5 text-gold/80" />
        </a>
      </div>
    </article>
  );
}

export function ProjectCards() {
  return (
    <ul className="grid gap-5 lg:grid-cols-3 lg:gap-6">
      {PROJECTS.map((project) => (
        <li key={project.slug} className="flex" data-testid={`project-${project.slug}`}>
          <ProjectCard project={project} />
        </li>
      ))}
    </ul>
  );
}
