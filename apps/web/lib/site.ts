export interface Project {
  slug: string;
  code: string;
  number: string;
  topic: string;
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
  external: boolean;
}

export const DEFAULT_SITE_URL = "https://kontoklar-eight.vercel.app";

export const OWNER_NAME = "Mirkan Deniz Günkaya";

export const GITHUB_PROFILE_URL = "https://github.com/mirkan-morgenfels-ai";

export const REPO_URL = "https://github.com/mirkan-morgenfels-ai/kontoklar";

export const HOME_DESCRIPTION =
  "Drei Portfolio-Projekte zu Finanzdaten, maschinellem Lernen und Graph-ML: DepotDoktor, KontoKlar und NetzRadar, jeweils mit öffentlichem Quellcode auf GitHub.";

export const PROJECTS: readonly Project[] = [
  {
    slug: "depotdoktor",
    code: "K1",
    number: "01",
    topic: "Finanzdaten",
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
    number: "02",
    topic: "Maschinelles Lernen",
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
    number: "03",
    topic: "Graph-ML",
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
  { href: "/", label: "Start", external: false },
  ...PROJECTS.map((project) => ({ href: project.href, label: project.title, external: project.external })),
  { href: GITHUB_PROFILE_URL, label: "GitHub", external: true },
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
