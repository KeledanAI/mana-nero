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

  test("Analytics: grafico slug campagne (se ci sono righe RPC)", async ({ page }) => {
    await page.goto("/admin/analytics");
    const chartHeading = page.getByText("Grafico a barre (slug × stato outbox)");
    test.skip((await chartHeading.count()) === 0, "Servono righe analytics_outbox per slug nel DB di test.");
    await expect(chartHeading).toBeVisible();
    await expect(page.getByTestId("analytics-campaign-slug-bars")).toBeVisible();
  });

  test("Comms staff raggiungibile (checklist DoD)", async ({ page }) => {
    await page.goto("/admin/comms");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    await expect(page.getByText("Comunicazioni automatizzate", { exact: true })).toBeVisible();
  });

  test("Comms: scan reminder eventi (server action staff)", async ({ page }) => {
    await page.goto("/admin/comms");
    await expect(page.getByTestId("comms-reminder-scan-form")).toBeVisible();
    await page.getByTestId("comms-reminder-scan-submit").click();
    await expect(page.getByTestId("comms-scan-flash")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comms-scan-flash")).toContainText(/Ultimo scan:/);
  });

  test("Comms: errore slug duplicato su record mostra messaggio leggibile", async ({ page }) => {
    await page.goto("/admin/comms");
    await expect(page.getByTestId("comms-campaign-record-form")).toBeVisible();
    const slug = `e2e-dup-${Date.now()}`;
    await page.getByTestId("comms-campaign-record-slug").fill(slug);
    await page.getByTestId("comms-campaign-record-title").fill(`Primo ${slug}`);
    await page.getByTestId("comms-campaign-record-submit").click();
    await expect(page.getByTestId("comms-campaign-record-flash")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comms-campaign-record-flash")).toContainText("Record campagna salvato");

    await page.getByTestId("comms-campaign-record-slug").fill(slug);
    await page.getByTestId("comms-campaign-record-title").fill(`Secondo ${slug}`);
    await page.getByTestId("comms-campaign-record-submit").click();
    await expect(page.getByTestId("comms-page-error")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comms-page-error")).toContainText("Esiste già");
    await expect(page.getByTestId("comms-page-error")).not.toContainText("duplicate key");
  });

  test("Comms: salva record campagna (metadati comms_campaigns)", async ({ page }) => {
    await page.goto("/admin/comms");
    await expect(page.getByTestId("comms-campaign-record-form")).toBeVisible();
    const slug = `e2e-camp-${Date.now()}`;
    await page.getByTestId("comms-campaign-record-slug").fill(slug);
    await page.getByTestId("comms-campaign-record-title").fill(`E2E ${slug}`);
    await page.getByTestId("comms-campaign-record-submit").click();
    await expect(page.getByTestId("comms-campaign-record-flash")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comms-campaign-record-flash")).toContainText("Record campagna salvato");
  });

  test("Comms: salva record campagna con segmento registration_confirmed", async ({ page }) => {
    await page.goto("/admin/comms");
    await expect(page.getByTestId("comms-campaign-record-form")).toBeVisible();
    const slug = `e2e-camp-conf-${Date.now()}`;
    await page.getByTestId("comms-campaign-record-slug").fill(slug);
    await page.getByTestId("comms-campaign-record-title").fill(`E2E confirmed ${slug}`);
    await page.getByTestId("comms-campaign-record-segment").selectOption("registration_confirmed");
    await page.getByTestId("comms-campaign-record-submit").click();
    await expect(page.getByTestId("comms-campaign-record-flash")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comms-campaign-record-flash")).toContainText("Record campagna salvato");
    const listRow = page.getByRole("listitem").filter({ hasText: slug });
    await expect(listRow).toContainText("registration_confirmed");
  });

  test("Comms: form accoda campagna espone segmento registration_confirmed", async ({ page }) => {
    await page.goto("/admin/comms");
    await expect(page.getByTestId("comms-segmented-campaign-form")).toBeVisible();
    const seg = page.getByTestId("comms-campaign-enqueue-segment");
    await expect(seg.locator('option[value="registration_confirmed"]')).toHaveCount(1);
  });

  test("Comms: errore enqueue manuale senza slug (messaggio leggibile)", async ({ page }) => {
    await page.goto("/admin/comms");
    await page.getByTestId("comms-campaign-record-picker").selectOption({ value: "" });
    await page.getByTestId("comms-campaign-subject-input").fill("Solo oggetto, senza slug");
    await page.getByTestId("comms-segmented-campaign-submit").click();
    await expect(page.getByTestId("comms-page-error")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comms-page-error")).toContainText("slug campagna valido");
    await expect(page.getByTestId("comms-page-error")).not.toContainText("campaign_id_invalid");
  });

  test("Comms: accoda campagna segmentata (server action, slug univoco)", async ({ page }) => {
    await page.goto("/admin/comms");
    await expect(page.getByTestId("comms-segmented-campaign-form")).toBeVisible();
    const slug = `e2e-seg-${Date.now()}`;
    await page.getByTestId("comms-campaign-id-input").fill(slug);
    await page.getByTestId("comms-campaign-subject-input").fill(`E2E enqueue ${slug}`);
    await page.getByTestId("comms-campaign-enqueue-segment").selectOption("registration_confirmed");
    await page.getByTestId("comms-segmented-campaign-submit").click();
    await expect(page.getByTestId("comms-campaign-enqueue-flash")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comms-campaign-enqueue-flash")).toHaveText(
      /Ultima campagna: \d+ destinatari considerati/,
    );
  });

  test("Comms: accoda campagna selezionando record comms_campaigns (binding server)", async ({ page }) => {
    await page.goto("/admin/comms");
    const slug = `e2e-bind-${Date.now()}`;
    const title = `E2E bind ${slug}`;
    await page.getByTestId("comms-campaign-record-slug").fill(slug);
    await page.getByTestId("comms-campaign-record-title").fill(title);
    await page.getByTestId("comms-campaign-record-segment").selectOption("registration_confirmed");
    await page.getByTestId("comms-campaign-record-submit").click();
    await expect(page.getByTestId("comms-campaign-record-flash")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comms-campaign-record-flash")).toContainText("Record campagna salvato");

    const recordOption = page
      .getByTestId("comms-campaign-record-picker")
      .locator("option")
      .filter({ hasText: slug });
    await expect(recordOption).toHaveCount(1);
    const recordId = await recordOption.getAttribute("value");
    expect(recordId).toBeTruthy();
    await page.getByTestId("comms-campaign-record-picker").selectOption(recordId!);
    await page.getByTestId("comms-segmented-campaign-submit").click();
    await expect(page.getByTestId("comms-campaign-enqueue-flash")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("comms-campaign-enqueue-flash")).toHaveText(
      /Ultima campagna: \d+ destinatari considerati/,
    );
  });

  test("Export CSV profili CRM (staff)", async ({ page }) => {
    const res = await page.context().request.get("/admin/crm/profiles.csv");
    expect(res.ok()).toBeTruthy();
    expect(res.headers()["content-type"] ?? "").toMatch(/text\/csv/);
    const body = await res.text();
    expect(body.split("\n")[0]).toMatch(/id,email,full_name/);
  });

  test("CRM scheda cliente: salva fase lead (mutazione staff)", async ({ page }) => {
    await page.goto("/admin/crm");
    await expect(page).not.toHaveURL(/\/auth\/login/);
    const profileLinks = page.getByRole("link", { name: "Scheda completa" });
    test.skip((await profileLinks.count()) === 0, "Serve almeno un profilo in elenco CRM (dati Supabase di test).");
    await profileLinks.first().click();
    await expect(page.getByTestId("crm-profile-form")).toBeVisible();
    const marker = `e2e-lead-${Date.now()}`;
    await page.getByTestId("crm-lead-stage-input").fill(marker);
    await page.getByTestId("crm-save-profile").click();
    await expect(page.getByTestId("crm-profile-flash")).toContainText("Profilo aggiornato.");
    await expect(page.getByTestId("crm-lead-stage-input")).toHaveValue(marker);
  });
});
