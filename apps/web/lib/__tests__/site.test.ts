import { afterEach, describe, expect, it, vi } from "vitest";
import { OG_IMAGE_ALT, OG_IMAGE_PATH, pageMetadata, withSiteName } from "../metadata";
import { DEFAULT_SITE_URL, LEGAL_LINKS, NAV_LINKS, PROJECTS, REPO_URL, repoFileUrl, siteUrl } from "../site";

describe("PROJECTS", () => {
  it("lists exactly the three portfolio projects in order", () => {
    expect(PROJECTS.map((project) => project.slug)).toEqual(["depotdoktor", "kontoklar", "netzradar"]);
    expect(PROJECTS.map((project) => project.code)).toEqual(["K1", "K2", "K3"]);
    expect(PROJECTS.map((project) => project.kicker)).toEqual(["Projekt K1", "Projekt K2", "Projekt K3"]);
  });

  it("links KontoKlar internally and the other two projects externally over https", () => {
    const kontoklar = PROJECTS.find((project) => project.slug === "kontoklar");
    expect(kontoklar).toMatchObject({ href: "/projects/kontoklar", external: false });
    expect(PROJECTS.filter((project) => project.external).map((project) => project.href)).toEqual([
      "https://depotdoktor.vercel.app/projects/depotdoktor",
      "https://netzradar.vercel.app/projects/netzradar",
    ]);
  });

  it("gives every project its public repository under mirkan-morgenfels-ai", () => {
    for (const project of PROJECTS) {
      expect(project.repo).toBe(`https://github.com/mirkan-morgenfels-ai/${project.slug}`);
    }
    expect(REPO_URL).toBe("https://github.com/mirkan-morgenfels-ai/kontoklar");
    expect(repoFileUrl("docs/genauigkeit.md")).toBe("https://github.com/mirkan-morgenfels-ai/kontoklar/blob/main/docs/genauigkeit.md");
  });

  it("uses the same project texts as K1 and K3", () => {
    expect(PROJECTS.map((project) => project.description)).toEqual([
      "Depot-Steuer- und Performance-Analyzer für Broker-CSV-Exporte. Die Auswertung läuft vollständig im Browser.",
      "Kategorisiert Bankumsätze aus CSV-Exporten und zeigt, wohin das Geld geht.",
      "Anomalie-Erkennung in Transaktionsnetzwerken: klassische Baseline gegen Graph Neural Networks, mit zeitlichem Split und PR-AUC.",
    ]);
  });
});

describe("navigation", () => {
  it("offers start plus the three projects, only KontoKlar internal", () => {
    expect(NAV_LINKS.map((link) => link.label)).toEqual(["Start", "DepotDoktor", "KontoKlar", "NetzRadar"]);
    expect(NAV_LINKS.filter((link) => !link.external).map((link) => link.href)).toEqual(["/", "/projects/kontoklar"]);
  });

  it("offers the three legal pages", () => {
    expect(LEGAL_LINKS.map((link) => link.href)).toEqual(["/impressum", "/datenschutz", "/nutzungsbedingungen"]);
  });
});

describe("siteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the production address for an empty value", () => {
    expect(siteUrl("").href).toBe("https://kontoklar-eight.vercel.app/");
    expect(siteUrl("   ").href).toBe("https://kontoklar-eight.vercel.app/");
    expect(DEFAULT_SITE_URL).toBe("https://kontoklar-eight.vercel.app");
  });

  it("uses a configured value and reads NEXT_PUBLIC_SITE_URL", () => {
    expect(siteUrl("https://kontoklar.example").href).toBe("https://kontoklar.example/");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.org");
    expect(siteUrl().href).toBe("https://example.org/");
  });

  it("rejects a malformed value", () => {
    expect(() => siteUrl("kein url")).toThrow();
  });
});

describe("pageMetadata", () => {
  it("adds canonical, open graph url and site name; titles follow the template", () => {
    const meta = pageMetadata({ path: "/impressum", title: "Impressum", description: "d" });
    expect(meta.title).toBe("Impressum");
    expect(meta.alternates?.canonical).toBe("/impressum");
    expect(meta.openGraph).toMatchObject({ url: "/impressum", siteName: "KontoKlar", title: "Impressum · KontoKlar" });
    expect(withSiteName("Impressum")).toBe("Impressum · KontoKlar");
  });

  it("keeps the preview image, because a page-level openGraph replaces the one from the layout", () => {
    const meta = pageMetadata({ path: "/datenschutz", title: "Datenschutzerklärung", description: "d" });
    expect(meta.openGraph?.images).toEqual([{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: OG_IMAGE_ALT }]);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", images: [{ url: "/opengraph-image", alt: OG_IMAGE_ALT }] });
  });

  it("keeps absolute titles unchanged", () => {
    const meta = pageMetadata({ path: "/", title: "Projekte · Mirkan Deniz Günkaya", absoluteTitle: true, description: "d" });
    expect(meta.title).toEqual({ absolute: "Projekte · Mirkan Deniz Günkaya" });
    expect(meta.openGraph?.title).toBe("Projekte · Mirkan Deniz Günkaya");
  });
});
