import { PORTFOLIO_LABEL, PORTFOLIO_URL, PROJECTS } from "@/lib/site";

export const PORTFOLIO_TRANSITION_MS = 560;

export interface TransitionDestination {
  eyebrow: string;
  title: string;
  accent: string | null;
  host: string;
}

export function transitionDestination(href: string): TransitionDestination | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.host === new URL(PORTFOLIO_URL).host) {
    return { eyebrow: "Zurück zur Website", title: "Mirkan", accent: "Deniz", host: PORTFOLIO_LABEL };
  }
  const project = PROJECTS.find((entry) => entry.external && new URL(entry.href).host === url.host);
  return project ? { eyebrow: "Weiter zum Projekt", title: project.title, accent: null, host: url.host } : null;
}
