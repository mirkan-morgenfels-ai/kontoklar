export interface Project {
  slug: string;
  number: string;
  topic: string;
  kicker: string;
  title: string;
  href: string;
  external: boolean;
}

export interface NavLink {
  href: string;
  label: string;
  external: boolean;
}

export const DEFAULT_SITE_URL = "https://kontoklar.mirkandeniz.de";

export const LEGACY_HOSTS: readonly string[] = ["kontoklar-eight.vercel.app"];

export const PROJECT_PATH = "/projects/kontoklar";

export const PORTFOLIO_URL = "https://mirkandeniz.de";

export const PORTFOLIO_LABEL = "mirkandeniz.de";

export const PORTFOLIO_PROJECTS_URL = `${PORTFOLIO_URL}/projekte`;

export const PORTFOLIO_HOME_URL = `${PORTFOLIO_URL}/#start`;

export const OWNER_NAME = "Mirkan Deniz Günkaya";

export const GITHUB_PROFILE_URL = "https://github.com/mirkan-morgenfels-ai";

export const REPO_URL = "https://github.com/mirkan-morgenfels-ai/kontoklar";

export const PROJECTS: readonly Project[] = [
  {
    slug: "depotdoktor",
    number: "01",
    topic: "Finanzdaten",
    kicker: "Projekt 01",
    title: "DepotDoktor",
    href: "https://depotdoktor.mirkandeniz.de/projects/depotdoktor",
    external: true,
  },
  {
    slug: "kontoklar",
    number: "02",
    topic: "Maschinelles Lernen",
    kicker: "Projekt 02",
    title: "KontoKlar",
    href: PROJECT_PATH,
    external: false,
  },
  {
    slug: "netzradar",
    number: "03",
    topic: "Graph-ML",
    kicker: "Projekt 03",
    title: "NetzRadar",
    href: "https://netzradar.mirkandeniz.de/projects/netzradar",
    external: true,
  },
];

export const NAV_LINKS: readonly NavLink[] = [
  ...PROJECTS.map((project) => ({ href: project.href, label: project.title, external: project.external })),
  { href: PORTFOLIO_PROJECTS_URL, label: "Alle Projekte", external: true },
];

export const LEGAL_LINKS: readonly NavLink[] = [
  { href: "/impressum", label: "Impressum", external: false },
  { href: "/datenschutz", label: "Datenschutz", external: false },
  { href: "/nutzungsbedingungen", label: "Nutzungsbedingungen", external: false },
];

export function repoFileUrl(path: string): string {
  return `${REPO_URL}/blob/main/${path}`;
}

export function siteUrl(value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): URL {
  const trimmed = value?.trim();
  return new URL(trimmed ? trimmed : DEFAULT_SITE_URL);
}
