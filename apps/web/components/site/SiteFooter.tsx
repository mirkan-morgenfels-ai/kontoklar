import Link from "next/link";
import { GITHUB_PROFILE_URL, LEGAL_LINKS, OWNER_NAME, PROJECTS, REPO_URL } from "@/lib/site";
import { Brand } from "./Brand";
import { ExternalMark } from "./ExternalMark";
import { Shell } from "./Shell";

const LINK_CLASS = "inline-flex items-center text-ivory/90 transition-colors duration-150 hover:text-gold-light";

function ColumnTitle({ children }: { children: string }) {
  return <h2 className="eyebrow">{children}</h2>;
}

export function SiteFooter() {
  return (
    <footer className="surface-navy relative">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-gold/0 via-gold/70 to-gold/0" />
      <Shell className="pt-16 pb-10 md:pt-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <Brand />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-navy-300">
              Privates, nicht-kommerzielles Portfolio zu Daten, KI und Finanzen. Alle Projekte mit öffentlichem Quellcode.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-10 min-[360px]:grid-cols-2 sm:grid-cols-[1fr_1fr_1.35fr] lg:col-span-7">
            <nav aria-label="Projekte">
              <ColumnTitle>Projekte</ColumnTitle>
              <ul className="mt-5 space-y-3 text-sm leading-5">
                {PROJECTS.map((project) => (
                  <li key={project.slug} className="flex items-baseline gap-3 leading-5">
                    <span aria-hidden="true" className="display num w-5 text-base leading-5 text-gold-light/80">
                      {project.number}
                    </span>
                    {project.external ? (
                      <a href={project.href} rel="noopener noreferrer" className={LINK_CLASS}>
                        {project.title}
                        <span className="sr-only"> (externe Seite)</span>
                        <ExternalMark className="ml-1.5 h-2.5 w-2.5 text-gold/80" />
                      </a>
                    ) : (
                      <Link href={project.href} className={LINK_CLASS}>
                        {project.title}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-label="Rechtliches">
              <ColumnTitle>Rechtliches</ColumnTitle>
              <ul className="mt-5 space-y-3 text-sm leading-5">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={LINK_CLASS}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="min-[360px]:col-span-2 sm:col-span-1">
              <ColumnTitle>Quellcode</ColumnTitle>
              <ul className="mt-5 space-y-3 text-sm leading-5">
                <li className="text-navy-300">
                  <a href={REPO_URL} rel="noopener noreferrer" className={LINK_CLASS} data-testid="footer-repo-link">
                    Quellcode auf GitHub<span className="sr-only"> (externe Seite)</span>
                    <ExternalMark className="ml-1.5 h-2.5 w-2.5 text-gold/80" />
                  </a>{" "}
                  <span className="ml-1 text-xs whitespace-nowrap text-navy-300">(MIT-Lizenz)</span>
                </li>
                <li>
                  <a href={GITHUB_PROFILE_URL} rel="noopener noreferrer" className={LINK_CLASS}>
                    GitHub-Profil<span className="sr-only"> (externe Seite)</span>
                    <ExternalMark className="ml-1.5 h-2.5 w-2.5 text-gold/80" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-navy-700 pt-6 text-xs text-navy-300 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="block sm:inline">© 2026 {OWNER_NAME}</span>
            <span aria-hidden="true" className="hidden sm:inline">{" · "}</span>
            <span className="block sm:inline">Privates, nicht-kommerzielles Projekt</span>
          </p>
        </div>
      </Shell>
    </footer>
  );
}
