import { expect, test } from "@playwright/test";

test.describe("Hub contenuti", () => {
  test("pagina news indice", async ({ page }) => {
    await page.goto("/news");
    await expect(
      page.getByRole("heading", { name: /Aggiornamenti con ritmo editoriale/i }),
    ).toBeVisible();
  });

  test("pagina giochi indice", async ({ page }) => {
    await page.goto("/giochi");
    await expect(page.getByRole("heading", { name: /Scegli la tua modalità/i })).toBeVisible();
  });
});
