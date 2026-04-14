import { expect, test } from "@playwright/test";

/**
 * Pagina check-in pubblica (token): nessun login; copre UX errori comuni (ROADMAP QR / backlog qualità e2e).
 */
test.describe("Check-in pubblico per token", () => {
  test("token non UUID mostra link non valido", async ({ page }) => {
    await page.goto("/events/check-in/not-a-real-token");
    await expect(page.getByTestId("check-in-invalid-token")).toBeVisible();
    await expect(page.getByText("Link non valido", { exact: true })).toBeVisible();
    await expect(page.getByText(/formato atteso/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Torna agli eventi/i })).toBeVisible();
  });

  test("UUID sconosciuto mostra messaggio token non trovato", async ({ page }) => {
    await page.goto("/events/check-in/11111111-1111-4111-8111-111111111111");
    await expect(page.getByTestId("check-in-error")).toBeVisible();
    await expect(page.getByText("Check-in", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/non è più valido o non esiste/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Torna agli eventi/i })).toBeVisible();
  });
});
