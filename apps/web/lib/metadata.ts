import type { Metadata } from "next";

export const SITE_NAME = "KontoKlar";

export const SITE_DESCRIPTION =
  "Kategorisiert Bankumsätze aus CSV-Exporten und zeigt, wohin das Geld geht. Keine Kontoanbindung, keine Speicherung von Umsätzen.";

export const SOCIAL_DESCRIPTION =
  "Bank-CSV rein, Dashboard raus. Regel-Engine im Browser; Embedding- und Sprachmodell-Stufe implementiert, derzeit nicht freigeschaltet.";

export const OG_IMAGE_PATH = "/opengraph-image";

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const OG_IMAGE_ALT = "KontoKlar: Bankumsätze aus CSV-Exporten kategorisieren";

export function withSiteName(title: string): string {
  return `${title} · ${SITE_NAME}`;
}

export function pageMetadata({
  path,
  title,
  absoluteTitle,
  description,
}: {
  path: string;
  title: string;
  absoluteTitle?: boolean;
  description: string;
}): Metadata {
  const fullTitle = absoluteTitle ? title : withSiteName(title);
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "de_DE",
      type: "website",
      images: [{ url: OG_IMAGE_PATH, ...OG_IMAGE_SIZE, alt: OG_IMAGE_ALT }],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [{ url: OG_IMAGE_PATH, alt: OG_IMAGE_ALT }] },
  };
}
