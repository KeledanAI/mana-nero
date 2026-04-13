import { expect, test } from "@playwright/test";

test.describe("Contatti", () => {
  test("pagina contatti e heading principale", async ({ page }) => {
    await page.goto("/contact");
    await expect(
      page.getByRole("heading", { name: /Mana Nero Fumetteria — il cuore ludico di Tradate/i }),
    ).toBeVisible();
  });
});
