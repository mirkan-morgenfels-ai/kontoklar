import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

interface AxeViolation {
  id: string;
  nodes: Array<{ target: unknown[] }>;
}

interface AxeWindow {
  axe: {
    run: (
      context: Document,
      options: { runOnly: { type: "tag" | "rule"; values: string[] } },
    ) => Promise<{ violations: AxeViolation[] }>;
  };
}

const LEGAL_PAGES = [
  { path: "/impressum", heading: "Impressum", title: "Impressum · KontoKlar" },
  { path: "/datenschutz", heading: "Datenschutzerklärung", title: "Datenschutzerklärung · KontoKlar" },
  { path: "/nutzungsbedingungen", heading: "Nutzungsbedingungen", title: "Nutzungsbedingungen · KontoKlar" },
];
const LEGAL_UPDATED = "07.10.2026";
const REPO_BASE = "https://github.com/mirkan-morgenfels-ai";
const KONTOKLAR_REPO = `${REPO_BASE}/kontoklar`;
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://kontoklar-eight.vercel.app").replace(/\/+$/, "");
const HOME_TITLE = "Projekte · Mirkan Deniz Günkaya";
const HOME_DESCRIPTION =
  "Drei Portfolio-Projekte zu Finanzdaten, maschinellem Lernen und Graph-ML: DepotDoktor, KontoKlar und NetzRadar, jeweils mit öffentlichem Quellcode auf GitHub.";
const PROJECT_TITLE = "KontoKlar – Bankumsätze kategorisieren";
const NOT_FOUND = "/gibt-es-nicht";
const PUBLIC_PATHS = ["/", "/projects/kontoklar", ...LEGAL_PAGES.map((legal) => legal.path)];
const AXE_SOURCE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const AXE_WIDTHS = [390, 768, 1280];
const FIXTURES = path.resolve(__dirname, "..", "..", "..", "packages", "csv", "fixtures");
const GOLD_DEEP = "rgb(125, 95, 23)";
const GOLD_LIGHT = "rgb(216, 189, 114)";

test.describe.configure({ timeout: 180_000 });

async function openProject(page: Page) {
  await page.goto("/projects/kontoklar");
  await expect(page.getByTestId("upload-zone")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
}

async function metaContent(page: Page, selector: string): Promise<string | null> {
  return page.locator(selector).first().getAttribute("content");
}

async function runAxe(page: Page, runOnly: { type: "tag" | "rule"; values: string[] }): Promise<string[]> {
  await page.addScriptTag({ content: AXE_SOURCE });
  return page.evaluate(async (options) => {
    const result = await (window as unknown as AxeWindow).axe.run(document, { runOnly: options });
    return result.violations.map(
      (violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
    );
  }, runOnly);
}

async function uploadDkb(page: Page) {
  await openProject(page);
  await page.getByTestId("csv-input").setInputFiles(path.join(FIXTURES, "dkb.csv"));
  await page.getByRole("button", { name: "Kategorisieren" }).click();
  await expect(page.getByText("Ergebnis für dkb.csv")).toBeVisible();
  await expect(page.getByTestId("monthly-chart")).toBeVisible();
}

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

async function cspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { cspViolations?: string[] }).cspViolations ?? []);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const target = window as unknown as { cspViolations: string[] };
    target.cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      target.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });
});

test("start page lists the three projects with project and source links", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Drei Projekte zu Finanzdaten, maschinellem Lernen und Graph-ML" }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { level: 2, name: "Projekte", exact: true })).toBeVisible();
  const headingFont = await page.getByRole("heading", { level: 1 }).evaluate((element) => getComputedStyle(element).fontFamily);
  expect(headingFont).toContain("Cormorant Garamond");
  const bodyFont = await page.locator("body").evaluate((element) => getComputedStyle(element).fontFamily);
  expect(bodyFont).toContain("Inter");
  await expect(page.getByTestId(/^project-/)).toHaveCount(3);
  await expect(page.getByRole("main")).not.toContainText("In Arbeit");

  for (const slug of ["depotdoktor", "netzradar"]) {
    const link = page.getByTestId(`project-${slug}`).getByRole("link", { name: /^Live ansehen/ });
    await expect(link).toHaveAttribute("href", new RegExp(`^https://${slug}\\.vercel\\.app/projects/${slug}$`));
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link).not.toHaveAttribute("target", /.+/);
    await expect(link).toContainText("(externe Seite)");
  }

  await expect(page.getByTestId("project-kontoklar").getByRole("link", { name: /^Live ansehen/ })).toHaveAttribute(
    "href",
    "/projects/kontoklar",
  );

  for (const slug of ["depotdoktor", "kontoklar", "netzradar"]) {
    const repo = page.getByTestId(`project-${slug}`).getByRole("link", { name: /^Quellcode/ });
    await expect(repo).toHaveAttribute("href", `${REPO_BASE}/${slug}`);
    await expect(repo).toHaveAttribute("rel", "noopener noreferrer");
    await expect(repo).not.toHaveAttribute("target", /.+/);
  }
});

test("main navigation, skip link and aria-current", async ({ page }) => {
  await openProject(page);
  const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
  const links = nav.getByRole("list").getByRole("link");
  await expect(links).toHaveCount(5);
  await expect(links.nth(0)).toHaveText("Start");
  await expect(links.nth(1)).toHaveAccessibleName("DepotDoktor (externe Seite)");
  await expect(links.nth(2)).toHaveText("KontoKlar");
  await expect(links.nth(3)).toHaveAccessibleName("NetzRadar (externe Seite)");
  await expect(links.nth(4)).toHaveAccessibleName("GitHub (externe Seite)");
  await expect(links.nth(4)).toHaveAttribute("href", REPO_BASE);
  for (const index of [1, 3, 4]) {
    await expect(links.nth(index)).toHaveAttribute("href", /^https:\/\//);
    await expect(links.nth(index)).toHaveAttribute("rel", "noopener noreferrer");
    await expect(links.nth(index)).not.toHaveAttribute("target", /.+/);
  }
  await expect(links.nth(2)).toHaveAttribute("aria-current", "page");
  await expect(links.nth(0)).not.toHaveAttribute("aria-current", /.+/);
  await expect(page.locator("a.skip-link")).toHaveAttribute("href", "#main");

  await page.goto("/");
  await expect(nav.getByRole("link", { name: "Start" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "KontoKlar", exact: true })).not.toHaveAttribute("aria-current", /.+/);
});

test("the header sticks from 640 px on and scrolls away on phones", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openProject(page);
  const header = page.locator("body > header");
  await expect(header).not.toHaveCSS("position", "sticky");
  const height = await header.evaluate((element) => element.getBoundingClientRect().height);
  expect(height).toBeLessThanOrEqual(100);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(header).toHaveCSS("position", "sticky");
  await expect(header.getByRole("navigation", { name: "Hauptnavigation" }).locator("svg")).toHaveCount(3);
});

test("every route has skip link, header, main and a footer with three legal links", async ({ page }) => {
  for (const target of [...PUBLIC_PATHS, NOT_FOUND]) {
    await page.goto(target);
    await expect(page.locator("a.skip-link"), target).toHaveText("Zum Inhalt springen");
    await expect(page.locator("header nav[aria-label='Hauptnavigation']"), target).toBeVisible();
    await expect(page.locator("main#main"), target).toHaveCount(1);
    const legal = page.getByRole("navigation", { name: "Rechtliches" }).getByRole("link");
    await expect(legal, target).toHaveText(["Impressum", "Datenschutz", "Nutzungsbedingungen"]);
  }
});

test("keyboard focus shows a 2 px outline: gold-light on navy, gold-deep on light surfaces", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.locator("a.skip-link");
  await expect(skip).toBeFocused();
  await expect(skip).toHaveCSS("outline-color", GOLD_LIGHT);
  await expect(skip).toHaveCSS("outline-style", "solid");
  await expect(skip).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Tab");
  const brand = page.locator("header").getByRole("link", { name: /^Mirkan Deniz Günkaya/ });
  await expect(brand).toBeFocused();
  await expect(brand).toHaveCSS("outline-color", GOLD_LIGHT);
  await expect(brand).toHaveCSS("outline-width", "2px");

  await openProject(page);
  const dropZone = page.getByRole("button", { name: /^CSV hierher ziehen oder klicken/ });
  await dropZone.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(dropZone).toBeFocused();
  await expect(dropZone).toHaveCSS("outline-color", GOLD_DEEP);
  await expect(dropZone).toHaveCSS("outline-style", "solid");
  await expect(dropZone).toHaveCSS("outline-width", "2px");
  await page.keyboard.press("Tab");
  const sample = page.getByRole("button", { name: "Mit Beispieldaten ausprobieren" });
  await expect(sample).toBeFocused();
  await expect(sample).toHaveCSS("outline-color", GOLD_LIGHT);
  await expect(sample).toHaveCSS("outline-width", "2px");
});

test("footer and project page link the public repository", async ({ page }) => {
  await page.goto("/");
  const footerLink = page.getByTestId("footer-repo-link");
  await expect(footerLink).toHaveAttribute("href", KONTOKLAR_REPO);
  await expect(footerLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(footerLink).toHaveAccessibleName("Quellcode auf GitHub (externe Seite)");
  await expect(page.locator("footer")).toContainText("Quellcode auf GitHub (externe Seite) (MIT-Lizenz)");

  await openProject(page);
  await expect(page.getByTestId("project-repo-link")).toHaveAttribute("href", KONTOKLAR_REPO);
  const external = page.locator(`a[href^="${REPO_BASE}"]`);
  for (const link of await external.all()) await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator("a[target]")).toHaveCount(0);

  for (const target of ["/impressum", "/nutzungsbedingungen"]) {
    await page.goto(target);
    await expect(page.getByRole("main").getByRole("link", { name: /^(MIT-Lizenz|GitHub)/ }).first()).toHaveAttribute(
      "href",
      /^https:\/\/github\.com\/mirkan-morgenfels-ai\/kontoklar/,
    );
  }
});

for (const legal of LEGAL_PAGES) {
  test(`legal page ${legal.path} renders with heading and date`, async ({ page }) => {
    const response = await page.goto(legal.path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: legal.heading })).toBeVisible();
    await expect(page.getByText(`Stand: ${LEGAL_UPDATED}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText("Platzhalter");
  });
}

test("operator details on imprint and privacy page", async ({ page }) => {
  for (const target of ["/impressum", "/datenschutz"]) {
    await page.goto(target);
    const main = page.getByRole("main");
    await expect(main).toContainText("Mirkan Deniz Günkaya");
    await expect(main).toContainText("München");
    await expect(main).toContainText("mirkandeniz52@gmail.com");
  }
  const main = page.getByRole("main");
  await expect(main).toContainText("HMAC-SHA256");
  await expect(main).toContainText("Diese Seite verlinkt auf die Projekte DepotDoktor und NetzRadar");
  await expect(main).toContainText("Quellcode-Repositories bei GitHub (GitHub, Inc., USA)");
  await expect(main).toContainText("den pseudonymisierten Zähler des Aufruflimits");
  await expect(main).toContainText("Konfidenz unter 0,5");
  await expect(main.getByRole("link", { name: /^Datenschutzerklärung von Vercel/ })).toHaveAttribute(
    "href",
    "https://vercel.com/legal/privacy-notice",
  );

  await page.goto("/impressum");
  await page.getByRole("main").locator("article").getByRole("link", { name: "Nutzungsbedingungen" }).click();
  await expect(page).toHaveURL(/\/nutzungsbedingungen$/);
});

test("no page overflows horizontally at 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  for (const target of [...PUBLIC_PATHS, NOT_FOUND]) {
    await page.goto(target);
    await page.waitForLoadState("load");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth, target).toBeLessThanOrEqual(320);
  }
});

test("unknown paths answer 404 with a noindex title", async ({ page }) => {
  const response = await page.goto(NOT_FOUND);
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Seite nicht gefunden" })).toBeVisible();
  await expect(page).toHaveTitle("Seite nicht gefunden · KontoKlar");
  const robots = await page.locator('meta[name="robots"]').evaluateAll((metas) => metas.map((meta) => meta.getAttribute("content") ?? ""));
  expect(robots.length).toBeGreaterThan(0);
  for (const content of robots) expect(content).toContain("noindex");
});

test("pages carry canonical links, link previews and distinct titles", async ({ page, request }) => {
  const titles: Record<string, string> = {};
  for (const target of PUBLIC_PATHS) {
    await page.goto(target);
    titles[target] = await page.title();
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical, target).not.toBeNull();
    expect(new URL(canonical ?? "").origin, target).toBe(SITE_URL);
    expect(new URL(canonical ?? "").pathname, target).toBe(target);
    expect(await metaContent(page, 'meta[property="og:url"]'), target).toBe(canonical);
    expect(await metaContent(page, 'meta[property="og:site_name"]'), target).toBe("KontoKlar");
    expect(await metaContent(page, 'meta[property="og:title"]'), target).toBe(titles[target]);
    expect(await metaContent(page, 'meta[name="description"]'), target).toBeTruthy();
    expect(await metaContent(page, 'meta[name="twitter:card"]'), target).toBe("summary_large_image");
    const image = await metaContent(page, 'meta[property="og:image"]');
    expect(image, target).toMatch(/^https:\/\//);
    expect(new URL(image ?? "").origin, target).toBe(SITE_URL);
    const local = await request.get(new URL(image ?? "").pathname + new URL(image ?? "").search);
    expect(local.status(), target).toBe(200);
    expect(local.headers()["content-type"], target).toContain("image/png");
  }
  await page.goto("/");
  expect(await metaContent(page, 'meta[name="description"]')).toBe(HOME_DESCRIPTION);
  expect(await metaContent(page, 'meta[property="og:description"]')).toBe(HOME_DESCRIPTION);
  expect(titles["/"]).toBe(HOME_TITLE);
  expect(titles["/projects/kontoklar"]).toBe(PROJECT_TITLE);
  for (const legal of LEGAL_PAGES) expect(titles[legal.path]).toBe(legal.title);
  expect(await metaContent(page, 'meta[property="og:image:alt"]')).toBe("KontoKlar: Bankumsätze aus CSV-Exporten kategorisieren");
});

test("sitemap, robots.txt and icons", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
  for (const target of ["/projects/kontoklar", ...LEGAL_PAGES.map((legal) => legal.path)]) {
    expect(xml).toContain(`<loc>${SITE_URL}${target}</loc>`);
  }
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const text = await robots.text();
  expect(text).toContain("Disallow: /api/");
  expect(text).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  for (const icon of ["/apple-icon", "/opengraph-image"]) {
    const response = await request.get(icon);
    expect(response.status(), icon).toBe(200);
    expect(response.headers()["content-type"], icon).toContain("image/png");
  }
});

test("pages only send same-origin GET requests and stay free of console errors and CSP violations", async ({ page, baseURL }) => {
  const origin = new URL(baseURL ?? "http://localhost:3000").origin;
  const violations: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origin || request.method() !== "GET") violations.push(`${request.method()} ${request.url()}`);
  });
  const errors = watchErrors(page);

  for (const target of PUBLIC_PATHS) {
    await page.goto(target);
    await page.waitForLoadState("load");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await cspViolations(page), target).toEqual([]);
  }
  await uploadDkb(page);
  expect(await cspViolations(page)).toEqual([]);

  expect(violations.filter((v) => v.includes("challenges.cloudflare.com"))).toEqual([]);
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

for (const width of AXE_WIDTHS) {
  test(`axe reports no violations at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const results: Record<string, string[]> = {};
    for (const target of [...PUBLIC_PATHS, NOT_FOUND]) {
      await page.goto(target);
      await page.waitForLoadState("load");
      results[target] = await runAxe(page, { type: "tag", values: AXE_TAGS });
    }
    await uploadDkb(page);
    await page.getByRole("button", { name: /^Alle \(/ }).click();
    results["/projects/kontoklar nach Upload"] = await runAxe(page, { type: "tag", values: AXE_TAGS });
    await openProject(page);
    await page.getByRole("button", { name: "Mit Beispieldaten ausprobieren" }).click();
    await expect(page.getByTestId("recurring-table")).toBeVisible();
    await page.getByText("Zuordnung Kategorie → COICOP-Abteilung").click();
    results["/projects/kontoklar mit Beispieldaten"] = await runAxe(page, { type: "tag", values: AXE_TAGS });
    for (const [target, violations] of Object.entries(results)) expect(violations, target).toEqual([]);
  });
}

test("visible labels are part of the accessible names (label-content-name-mismatch)", async ({ page }) => {
  for (const target of ["/", "/projects/kontoklar"]) {
    await page.goto(target);
    await page.waitForLoadState("load");
    expect(await runAxe(page, { type: "rule", values: ["label-content-name-mismatch"] }), target).toEqual([]);
  }
  await uploadDkb(page);
  expect(await runAxe(page, { type: "rule", values: ["label-content-name-mismatch"] })).toEqual([]);
  await page.getByRole("button", { name: /^Alle \(/ }).click();
  const names = await page
    .getByRole("region", { name: "Buchungen zur Prüfung" })
    .getByRole("combobox")
    .evaluateAll((selects) => selects.map((s) => s.getAttribute("aria-label") ?? ""));
  expect(names.length).toBe(5);
  expect(new Set(names).size).toBe(5);
});
