import { expect, test } from "@playwright/test";

/**
 * Richiede `E2E_STAFF_STORAGE_STATE` (path a storageState Playwright generato con account **staff**).
 * Generazione: `npm run e2e:generate-staff-storage` (richiede E2E_STAFF_* o SMOKE_TEST_* con password in .env.local),
 * oppure `npx playwright codegen <BASE_URL> --save-storage=e2e/auth-staff.json` e login manuale staff.
 */
const staffStorage = process.env.E2E_STAFF_STORAGE_STATE?.trim();

test.describe("Admin staff (sessione salvata)", () => {
  test.skip(!staffStorage, "Imposta E2E_STAFF_STORAGE_STATE per eseguire questi test.");

  test.use({ storageState: staffStorage! });

  test("CRM elenco raggiungibile senza redirect a login", async ({ page }) => {
    await page.goto("/admin/crm");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByText("Clienti registrati", { exact: true })).toBeVisible();
  });

  test("Analytics staff raggiungibile", async ({ page }) => {
    await page.goto("/admin/analytics");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByText("Analytics staff", { exact: true })).toBeVisible();
  });

  test("Comms staff raggiungibile (checklist DoD)", async ({ page }) => {
    await page.goto("/admin/comms");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByText("Comunicazioni automatizzate", { exact: true })).toBeVisible();
  });

  test("Export CSV profili CRM (staff)", async ({ page }) => {
    const res = await page.context().request.get("/admin/crm/profiles.csv");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"] ?? "").toMatch(/text\/csv/);
    const body = await res.text();
    expect(body.split("\n")[0]).toMatch(/id,email,full_name/);
  });
});
