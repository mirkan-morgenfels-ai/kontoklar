export interface Project {
  slug: string;
  code: string;
  kicker: string;
  title: string;
  description: string;
  href: string;
  external: boolean;
  repo: string;
}

export interface NavLink {
  href: string;
  label: string;
  external?: boolean;
}

export const DEFAULT_SITE_URL = "https://kontoklar-eight.vercel.app";

export const REPO_URL = "https://github.com/mirkan-morgenfels-ai/kontoklar";

export const PROJECTS: readonly Project[] = [
  {
    slug: "depotdoktor",
    code: "K1",
    kicker: "Projekt K1",
    title: "DepotDoktor",
    description:
      "Depot-Steuer- und Performance-Analyzer für Broker-CSV-Exporte. Die Auswertung läuft vollständig im Browser.",
    href: "https://depotdoktor.vercel.app/projects/depotdoktor",
    external: true,
    repo: "https://github.com/mirkan-morgenfels-ai/depotdoktor",
  },
  {
    slug: "kontoklar",
    code: "K2",
    kicker: "Projekt K2",
    title: "KontoKlar",
    description: "Kategorisiert Bankumsätze aus CSV-Exporten und zeigt, wohin das Geld geht.",
    href: "/projects/kontoklar",
    external: false,
    repo: REPO_URL,
  },
  {
    slug: "netzradar",
    code: "K3",
    kicker: "Projekt K3",
    title: "NetzRadar",
    description:
      "Anomalie-Erkennung in Transaktionsnetzwerken: klassische Baseline gegen Graph Neural Networks, mit zeitlichem Split und PR-AUC.",
    href: "https://netzradar.vercel.app/projects/netzradar",
    external: true,
    repo: "https://github.com/mirkan-morgenfels-ai/netzradar",
  },
];

export const NAV_LINKS: readonly NavLink[] = [
  { href: "/", label: "Start" },
  ...PROJECTS.map((project) => ({ href: project.href, label: project.title, external: project.external })),
];

export const LEGAL_LINKS: readonly NavLink[] = [
  { href: "/impressum", label: "Impressum" },
  { href: "/datenschutz", label: "Datenschutz" },
  { href: "/nutzungsbedingungen", label: "Nutzungsbedingungen" },
];

export function repoFileUrl(path: string): string {
  return `${REPO_URL}/blob/main/${path}`;
}

export function siteUrl(value: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): URL {
  const trimmed = value?.trim();
  return new URL(trimmed ? trimmed : DEFAULT_SITE_URL);
}
