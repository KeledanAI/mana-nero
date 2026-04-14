import { test, expect } from "@playwright/test";

test.describe("Admin analytics gate", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/admin/analytics");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
