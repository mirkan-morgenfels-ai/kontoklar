import path from "node:path";
import { expect, test } from "@playwright/test";

const fixtures = path.resolve(__dirname, "..", "..", "..", "packages", "csv", "fixtures");

test("Happy Path: DKB-CSV hochladen, Regel-Engine kategorisiert, Dashboard erscheint", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/") && req.method() === "POST") requests.push(req.postData() ?? "");
  });
  await page.goto("/projects/kontoklar");
  await page.getByTestId("csv-input").setInputFiles(path.join(fixtures, "dkb.csv"));
  await expect(page.getByText("Geladen: dkb.csv")).toBeVisible();
  const apiToggle = page.getByLabel("Unbekannte Händler per Embedding-API klären");
  await expect(apiToggle).toBeDisabled();
  await expect(apiToggle).not.toBeChecked();
  await expect(page.getByText("Derzeit nicht verfügbar")).toBeVisible();
  await page.getByRole("button", { name: "Kategorisieren" }).click();
  await expect(page.getByText("Ergebnis für dkb.csv")).toBeVisible();
  await expect(page.getByText("API-Schritt ausgeschaltet")).toBeVisible();
  await expect(page.getByText("3. Dashboard")).toBeVisible();
  await expect(page.getByText("Wiederkehrende Zahlungen")).toBeVisible();
  expect(requests).toHaveLength(0);
});

test("VR-Bank-CSV wird automatisch erkannt und kategorisiert", async ({ page }) => {
  await page.goto("/projects/kontoklar");
  await page.getByTestId("csv-input").setInputFiles(path.join(fixtures, "vrbank.csv"));
  await expect(page.getByText("Geladen: vrbank.csv")).toBeVisible();
  await expect(page.locator("select").first()).toContainText("VR-Bank");
  await page.getByRole("button", { name: "Kategorisieren" }).click();
  await expect(page.getByText("Ergebnis für vrbank.csv")).toBeVisible();
  await expect(page.getByText("VRBANK").first()).toBeVisible();
  await expect(page.getByText("3. Dashboard")).toBeVisible();
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
  expect(await post.json()).toMatchObject({ disabled: true });
});

test("Startseite und Rechtsseiten: DepotDoktor verlinkt, Betreiberangaben ohne Platzhalter", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "DepotDoktor" })).toHaveAttribute("href", "https://ai-project-1-web.vercel.app/projects/depotdoktor");
  await expect(page.getByTestId("project-netzradar")).toContainText("In Arbeit");
  await expect(page.getByTestId("project-netzradar").getByRole("link")).toHaveCount(0);
  for (const target of ["/impressum", "/datenschutz"]) {
    await page.goto(target);
    const main = page.locator("main");
    await expect(main).toContainText("Mirkan Deniz Günkaya");
    await expect(main).toContainText("München");
    await expect(main).toContainText("mirkandeniz52@gmail.com");
    await expect(main).toContainText("Stand: 06.10.2026");
    await expect(main).not.toContainText("Platzhalter");
  }
  await expect(page.locator("main")).toContainText("HMAC-SHA256");
});

test("PDF-Kontoauszug wird mit Hinweis auf den CSV-Export abgewiesen", async ({ page }) => {
  await page.goto("/projects/kontoklar");
  await page.getByTestId("csv-input").setInputFiles({
    name: "Kontoauszug.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n"),
  });
  await expect(page.getByRole("alert").filter({ hasText: "PDF" })).toContainText("PDF-Kontoauszüge kann KontoKlar nicht lesen");
  await expect(page.getByRole("button", { name: "Kategorisieren" })).toHaveCount(0);
});
