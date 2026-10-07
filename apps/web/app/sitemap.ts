import type { MetadataRoute } from "next";
import { LEGAL_LINKS, siteUrl } from "@/lib/site";

export const dynamic = "force-static";

const SITEMAP_PATHS = ["/", "/projects/kontoklar", ...LEGAL_LINKS.map((link) => link.href)];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return SITEMAP_PATHS.map((path) => ({ url: new URL(path, base).href }));
}
