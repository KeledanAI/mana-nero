import { expect, test } from "@playwright/test";

test.describe("Reserve e community", () => {
  test("pagina richiesta prodotto (h1)", async ({ page }) => {
    await page.goto("/reserve");
    await expect(page.getByRole("heading", { name: "Richiesta prodotto", level: 1 })).toBeVisible();
  });

  test("pagina community hub", async ({ page }) => {
    await page.goto("/community");
    await expect(
      page.getByRole("heading", { name: /Dal tavolo all'arena: scegli il tuo formato/i }),
    ).toBeVisible();
  });
});
