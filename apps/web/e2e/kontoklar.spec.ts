import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const fixtures = path.resolve(__dirname, "..", "..", "..", "packages", "csv", "fixtures");
const ACCURACY = JSON.parse(readFileSync(path.resolve(__dirname, "..", "..", "..", "docs", "genauigkeit.json"), "utf-8")) as {
  total: number;
  stages: Record<string, { count: number; correct: number }>;
  accuracyAssigned: number;
};
const INK = "rgb(15, 27, 45)";
const SLATE = "rgb(91, 100, 116)";
const MOSS = "rgb(47, 107, 58)";
const MOSS_SOFT = "rgb(223, 234, 223)";

test.describe.configure({ timeout: 120_000 });

async function openProject(page: Page) {
  await page.goto("/projects/kontoklar");
  await expect(page.getByTestId("upload-zone")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
}

function germanPercent(value: number, digits: number): string {
  return `${new Intl.NumberFormat("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(100 * value)} %`;
}

function watchRequests(page: Page, baseURL: string | undefined): string[] {
  const origin = new URL(baseURL ?? "http://localhost:3000").origin;
  const violations: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "data:" || url.protocol === "blob:") return;
    if (url.origin !== origin || request.method() !== "GET") violations.push(`${request.method()} ${request.url()}`);
  });
  return violations;
}

function watchConsole(page: Page): string[] {
  const messages: string[] = [];
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") messages.push(`${message.type()}: ${message.text()}`);
  });
  return messages;
}

async function upload(page: Page, name: string) {
  await openProject(page);
  await page.getByTestId("csv-input").setInputFiles(path.join(fixtures, name));
  await expect(page.getByText(`Geladen: ${name}`)).toBeVisible();
  await page.getByRole("button", { name: "Kategorisieren" }).click();
  await expect(page.getByText(`Ergebnis für ${name}`)).toBeVisible();
}

function stat(page: Page, label: string) {
  return page.getByTestId("stat-tile").filter({ has: page.getByText(label, { exact: true }) });
}

test("Happy Path: DKB-CSV hochladen, Regel-Engine kategorisiert, Dashboard erscheint", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/") && req.method() === "POST") requests.push(req.postData() ?? "");
  });
  await openProject(page);
  await page.getByTestId("csv-input").setInputFiles(path.join(fixtures, "dkb.csv"));
  await expect(page.getByText("Geladen: dkb.csv")).toBeVisible();
  const apiToggle = page.getByLabel("Unbekannte Händler per Embedding-API klären");
  await expect(apiToggle).toBeDisabled();
  await expect(apiToggle).not.toBeChecked();
  await expect(page.getByText("Derzeit nicht verfügbar")).toBeVisible();
  await page.getByRole("button", { name: "Kategorisieren" }).click();
  await expect(page.getByText("Ergebnis für dkb.csv")).toBeVisible();
  await expect(page.getByText("API-Schritt ausgeschaltet")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Dashboard", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wiederkehrende Zahlungen", exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
});

test("inflation card marks sample values and never says official", async ({ page }) => {
  await upload(page, "dkb.csv");
  await expect(page.getByText("Gesamtrate (Beispielwert)", { exact: true })).toBeVisible();
  await expect(page.getByText("Persönliche Rate (Beispielrechnung)", { exact: true })).toBeVisible();
  await expect(page.getByText("keine Destatis-Daten", { exact: true })).toBeVisible();
  await expect(page.getByText("Quelle: Beispielwerte, nicht Destatis.")).toBeVisible();
  await expect(page.getByText("Teilindizes nach COICOP-Abteilung (Beispielwerte)")).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("Amtliche");
  await expect(stat(page, "Persönliche Rate (Beispielrechnung)")).toHaveCount(1);
  const personal = stat(page, "Persönliche Rate (Beispielrechnung)").getByTestId("stat-value");
  await expect(personal).toHaveCSS("color", INK);
  await expect(stat(page, "Persönliche Rate (Beispielrechnung)")).toContainText(/\d{2}\/\d{4} → \d{2}\/\d{4}/);
  await expect(stat(page, "Gesamtrate (Beispielwert)").getByTestId("stat-value")).toHaveCSS("color", SLATE);
  await expect(page.getByTestId("inflation-readme-link")).toHaveAttribute("href", "https://github.com/mirkan-morgenfels-ai/kontoklar#readme");
  await expect(page.getByTestId("inflation-covered")).toContainText("Abgedeckt:");
  const table = page.getByTestId("inflation-table");
  await expect(table.getByRole("columnheader", { name: "Veränderung zum Vorjahr", exact: true })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Teilindex", exact: true })).toHaveCount(0);
  const sum = page.getByTestId("inflation-sum");
  await expect(sum.locator("td").first()).toHaveText(germanPercent(1, 1));
  await expect(sum.locator("td").last()).toHaveText(await personal.innerText());
  await page.getByText("Zuordnung Kategorie → COICOP-Abteilung").click();
  await expect(page.getByTestId("coicop-mapping")).toContainText("Bargeld");
  await expect(page.getByTestId("coicop-mapping")).toContainText("nicht abgedeckt");
});

test("chart legend uses ink text and income keeps moss for itself", async ({ page }) => {
  for (const name of ["dkb.csv", "ing.csv"]) {
    await upload(page, name);
    const legend = page.getByTestId("chart-legend");
    await expect(legend.getByText("Einnahmen", { exact: true })).toBeVisible();
    const items = legend.locator("li");
    const count = await items.count();
    expect(count).toBeGreaterThan(1);
    for (let i = 0; i < count; i++) await expect(items.nth(i)).toHaveCSS("color", INK);
    const swatches = await legend.locator("li > span").evaluateAll((spans) =>
      spans.map((span) => {
        const dot = span.querySelector<HTMLElement>("[data-marker-dot]");
        const marker = dot ?? span;
        return {
          label: span.parentElement?.textContent?.trim() ?? "",
          line: span.getAttribute("data-marker") === "line",
          fill: getComputedStyle(marker).backgroundColor,
          stroke: getComputedStyle(marker).borderTopColor,
        };
      }),
    );
    const income = swatches.find((s) => s.label === "Einnahmen");
    expect(income).toEqual({ label: "Einnahmen", line: true, fill: MOSS_SOFT, stroke: MOSS });
    for (const s of swatches.filter((x) => x.label !== "Einnahmen")) {
      expect(s.line, s.label).toBe(false);
      expect([MOSS, MOSS_SOFT], s.label).not.toContain(s.fill);
    }
    const labels = await page.getByTestId("monthly-chart").locator(".recharts-cartesian-axis-tick-value").allTextContents();
    const ticks = labels.filter((label) => label.includes("€"));
    expect(ticks.length).toBeGreaterThan(1);
    if (name === "dkb.csv") expect(ticks).toEqual(["0 €", "1.000 €", "2.000 €", "3.000 €"]);
    for (const tick of ticks) expect(tick).toMatch(/^\d{1,3}(\.\d{3})*\s€$/);
  }
});

test("chart tooltip lists the stack from top to bottom with colour marks, income last", async ({ page }) => {
  await openProject(page);
  await page.getByRole("button", { name: "Mit Beispieldaten ausprobieren" }).click();
  const chart = page.getByTestId("monthly-chart");
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move((box?.x ?? 0) + (box?.width ?? 0) * 0.55, (box?.y ?? 0) + (box?.height ?? 0) * 0.5);
  const rows = page.locator(".recharts-tooltip-wrapper li");
  await expect(rows.last()).toContainText("Einnahmen: ");
  const texts = (await rows.allTextContents()).map((text) => text.split(":")[0]?.trim() ?? "");
  const legend = (await page.getByTestId("chart-legend").locator("li").allTextContents()).map((text) => text.trim());
  const stack = legend.filter((label) => label !== "Einnahmen");
  const expected = [...stack].reverse().filter((label) => texts.includes(label));
  expect(texts.slice(0, -1)).toEqual(expected);
  expect(await rows.locator("[aria-hidden='true']").count()).toBeGreaterThanOrEqual(texts.length);
});

test("VR-Bank-CSV wird automatisch erkannt und kategorisiert", async ({ page }) => {
  await openProject(page);
  await page.getByTestId("csv-input").setInputFiles(path.join(fixtures, "vrbank.csv"));
  await expect(page.getByText("Geladen: vrbank.csv")).toBeVisible();
  await expect(page.locator("select").first()).toContainText("VR-Bank");
  await page.getByRole("button", { name: "Kategorisieren" }).click();
  await expect(page.getByText("Ergebnis für vrbank.csv")).toBeVisible();
  await expect(stat(page, "Buchungen")).toContainText("VR-Bank / Volksbank / Raiffeisenbank");
  await expect(page.getByText("VRBANK", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "Dashboard", exact: true })).toBeVisible();
});

test("ING upload causes no console warning (duplicate currency column)", async ({ page }) => {
  const messages = watchConsole(page);
  await upload(page, "ing.csv");
  await expect(page.getByRole("heading", { level: 2, name: "Dashboard", exact: true })).toBeVisible();
  expect(messages).toEqual([]);
});

test("sample data: one click shows dashboard, recurring payments and review list without any POST", async ({ page, baseURL }) => {
  const violations = watchRequests(page, baseURL);
  const messages = watchConsole(page);
  await openProject(page);
  await expect(page.getByText("Synthetische Beispieldaten, keine echten Kontodaten.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mit Beispieldaten ausprobieren" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Ergebnis für Beispieldaten", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetische Beispieldaten, keine echten Kontodaten. Personen und Konten sind erfunden.")).toBeVisible();
  await expect(stat(page, "Buchungen")).toContainText("147");
  const valueFont = await stat(page, "Buchungen").getByTestId("stat-value").evaluate((element) => getComputedStyle(element).fontFamily);
  expect(valueFont).toContain("Cormorant Garamond");
  await expect(page.getByTestId("monthly-chart")).toHaveAttribute("data-months", "6");
  await expect(page.getByTestId("recurring-table").locator("tr")).toHaveCount(8);
  await expect(page.getByTestId("recurring-table")).toContainText("vierteljährlich");
  await expect(page.getByTestId("recurring-table")).toContainText("18,36 € je Monat");
  await expect(stat(page, "Zur Prüfung").getByTestId("stat-value")).toHaveText("4");
  expect(violations).toEqual([]);
  expect(messages).toEqual([]);
});

test("a manual correction does not raise the automatic share", async ({ page }) => {
  await openProject(page);
  await page.getByRole("button", { name: "Mit Beispieldaten ausprobieren" }).click();
  const auto = stat(page, "Automatisch zugeordnet");
  await expect(auto).toContainText("97 %");
  await expect(auto).not.toContainText("manuell korrigiert");
  const select = page.getByRole("combobox", { name: /^Kategorie für Kiosk am Ring, 07\.02\.2026, -6,40/ });
  await expect(select).toHaveCount(1);
  await select.selectOption("Lebensmittel");
  await expect(auto).toContainText("97 %");
  await expect(auto).toContainText("1 manuell korrigiert");
});

test("review table: every category select has its own name, open bookings show no confidence", async ({ page }) => {
  await openProject(page);
  await page.getByRole("button", { name: "Mit Beispieldaten ausprobieren" }).click();
  await page.getByRole("button", { name: /^Alle \(/ }).click();
  const names = await page
    .getByRole("region", { name: "Buchungen zur Prüfung" })
    .getByRole("combobox")
    .evaluateAll((selects) => selects.map((s) => s.getAttribute("aria-label") ?? ""));
  expect(names.length).toBe(100);
  expect(new Set(names).size).toBe(names.length);
  for (const name of names) expect(name).toMatch(/^Kategorie für .+, \d{2}\.\d{2}\.\d{4}, -?[\d.]+,\d{2}\s€/);
  await page.getByRole("button", { name: /^Zur Prüfung \(/ }).click();
  const row = page.getByRole("row").filter({ hasText: "Erika Musterfrau" });
  await expect(row).toContainText("–");
  await expect(row).not.toContainText("60 %");
});

test("review table on a phone: amount and category fit, scroll hint only on overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await upload(page, "ing.csv");
  await page.getByRole("button", { name: /^Alle \(/ }).click();
  const region = page.getByRole("region", { name: "Buchungen zur Prüfung" });
  await expect(region).toHaveAttribute("tabindex", "0");
  const firstRow = region.getByRole("row").filter({ hasText: "EDEKA" });
  const amount = firstRow.getByText("-45,67", { exact: false });
  const select = firstRow.getByRole("combobox");
  for (const element of [amount, select]) {
    const box = await element.boundingBox();
    expect(box).not.toBeNull();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(390);
  }
  const overflowing = (await region.getAttribute("data-overflowing")) === "true";
  await expect(page.getByTestId("scroll-hint")).toHaveCount(overflowing ? 1 : 0);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("no horizontal page overflow at 320 and 390 px with sample data and after a DKB upload", async ({ page }) => {
  const scrollWidth = () => page.evaluate(() => document.documentElement.scrollWidth);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await openProject(page);
    await page.getByRole("button", { name: "Mit Beispieldaten ausprobieren" }).click();
    await expect(page.getByTestId("inflation-table")).toBeVisible();
    await page.getByText("Zuordnung Kategorie → COICOP-Abteilung").click();
    await expect(page.getByTestId("coicop-mapping")).toBeVisible();
    expect(await scrollWidth(), `Beispieldaten bei ${width} px`).toBeLessThanOrEqual(width);
    await upload(page, "dkb.csv");
    await expect(page.getByTestId("inflation-table")).toBeVisible();
    expect(await scrollWidth(), `dkb.csv bei ${width} px`).toBeLessThanOrEqual(width);
  }
});

test("project header shows the honest pipeline status and figures from genauigkeit.json", async ({ page }) => {
  await openProject(page);
  await expect(page.getByTestId("pipeline-status")).toHaveText(
    "Auf dieser Instanz aktiv: Regel-Engine im Browser. Embedding- und Sprachmodell-Stufe sind implementiert und mit Mocks getestet, aber noch nicht freigeschaltet.",
  );
  const coverage = (ACCURACY.stages.rule?.count ?? 0) / ACCURACY.total;
  const figures = page.getByTestId("rule-figures");
  await expect(figures).toContainText(`Regel-Engine auf ${ACCURACY.total} synthetischen Testbuchungen`);
  await expect(figures).toContainText(`${germanPercent(coverage, 1)} Abdeckung`);
  await expect(figures).toContainText(`${germanPercent(ACCURACY.accuracyAssigned, 1)} der zugeordneten richtig`);
  await expect(page.getByTestId("accuracy-doc-link")).toHaveAttribute(
    "href",
    "https://github.com/mirkan-morgenfels-ai/kontoklar/blob/main/docs/genauigkeit.md",
  );
});

test("API-Route ohne Konfiguration: Status deaktiviert mit Begründung, POST 503", async ({ request }) => {
  const status = await request.get("/api/categorize");
  const body = (await status.json()) as { enabled: boolean; reason: string; missing: string[] };
  expect(body.enabled).toBe(false);
  expect(body.missing).toContain("OPENAI_API_KEY");
  expect(body.missing).toContain("IP_HASH_SECRET");
  expect(body.reason).toContain("Auf dem Server fehlt Konfiguration");
  const post = await request.post("/api/categorize", { data: { texts: ["REWE SAGT DANKE"] } });
  expect(post.status()).toBe(503);
  const disabled = (await post.json()) as { disabled: boolean; reason: string };
  expect(disabled).toMatchObject({ disabled: true });
  expect(disabled.reason).not.toContain("Regel-Engine");
});

test("PDF-Kontoauszug wird mit Hinweis auf den CSV-Export abgewiesen", async ({ page }) => {
  await openProject(page);
  await page.getByTestId("csv-input").setInputFiles({
    name: "Kontoauszug.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"),
  });
  await expect(page.getByRole("alert").filter({ hasText: "PDF" })).toContainText("PDF-Kontoauszüge kann KontoKlar nicht lesen");
  await expect(page.getByRole("button", { name: "Kategorisieren" })).toHaveCount(0);
  await expect(page.getByText("Geladen: Kontoauszug.pdf")).toHaveCount(0);
  await expect(page.getByText("Nicht gelesen: Kontoauszug.pdf")).toBeVisible();
});

test("a clean upload opens the review list on all bookings and keeps zero counts quiet", async ({ page }) => {
  await upload(page, "dkb.csv");
  await expect(stat(page, "Zur Prüfung").getByTestId("stat-value")).toHaveText("0");
  await expect(page.getByRole("button", { name: /^Alle \(/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Buchungen zur Prüfung" }).getByRole("combobox")).toHaveCount(5);
  for (const label of ["Zur Prüfung", "Per API"]) {
    await expect(stat(page, label).getByTestId("stat-value")).toHaveCSS("color", SLATE);
  }
  await expect(page.getByRole("status").filter({ hasText: "API-Schritt ausgeschaltet" })).toHaveCSS("color", MOSS);
});
