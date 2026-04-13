import { expect, test } from "@playwright/test";

test.describe("Pagine pubbliche", () => {
  test("home risponde e mostra branding", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Mana Nero/i);
  });

  test("lista eventi è raggiungibile", async ({ page }) => {
    await page.goto("/events");
    await expect(
      page.getByRole("heading", { name: /Scopri le prossime serate/i }),
    ).toBeVisible();
  });
});
