import path from "node:path";
import { expect, test } from "@playwright/test";

const fixture = path.resolve(__dirname, "..", "..", "..", "packages", "csv", "fixtures", "dkb.csv");

test("Happy Path: DKB-CSV hochladen, Regel-Engine kategorisiert, Dashboard erscheint", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/") && req.method() === "POST") requests.push(req.postData() ?? "");
  });
  await page.goto("/projects/kontoklar");
  await page.getByTestId("csv-input").setInputFiles(fixture);
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
