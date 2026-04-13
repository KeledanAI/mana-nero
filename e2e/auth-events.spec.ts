import { expect, test } from "@playwright/test";

/**
 * Richiede una sessione salvata (magic link o login reale una volta), es.:
 *   npx playwright codegen http://localhost:3000 --save-storage=e2e/auth.json
 * Poi: E2E_STORAGE_STATE=e2e/auth.json npm run test:e2e
 *
 * Senza variabile, la suite è saltata (non fallisce in CI).
 */
const storagePath = process.env.E2E_STORAGE_STATE?.trim();

test.describe("Area eventi con sessione", () => {
  test.skip(!storagePath, "Imposta E2E_STORAGE_STATE al path di un file storageState.json");

  test.use({ storageState: storagePath! });

  test("pagina eventi con utente loggato", async ({ page }) => {
    await page.goto("/events");
    await expect(
      page.getByRole("heading", { name: /Scopri le prossime serate/i }),
    ).toBeVisible();
  });

  test("area protetta raggiungibile", async ({ page }) => {
    await page.goto("/protected");
    await expect(page).toHaveURL(/\/protected/);
  });
});
