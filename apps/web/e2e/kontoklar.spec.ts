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
