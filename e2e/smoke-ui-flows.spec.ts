import { expect, test } from "@playwright/test";

/**
 * Smoke UI (proxy del percorso manuale ROADMAP: login, eventi, area staff protetta).
 * Non richiede sessione: verifica che le pagine carichino e che /admin richieda login.
 */
test.describe("Smoke UI percorsi principali", () => {
  test("pagina login mostra flusso magic link", async ({ page }) => {
    await page.goto("/auth/login");
    // CardTitle è un div (non heading): verifica titolo e campo email.
    await expect(page.getByText("Accedi", { exact: true })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("lista eventi accessibile senza login", async ({ page }) => {
    await page.goto("/events");
    await expect(
      page.getByRole("heading", { name: /Scopri le prossime serate/i }),
    ).toBeVisible();
  });

  test("admin reindirizza al login se non autenticato", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
