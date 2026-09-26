import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test.describe("Interactive Recipe Features", () => {
  test("servings scaler, mark cooked toggle, and print card view", async ({ page }) => {
    // 1. Authenticate & create a recipe with known servings and ingredient quantities
    await registerUser(page);

    await page.click('header nav a[href*="/recipes/new"]');
    await expect(page).toHaveURL(/\/recipes\/new/);

    const uniqueId = Math.random().toString(36).substring(2, 8);
    const title = `Kaiserschmarrn ${uniqueId}`;

    await page.fill('input[id="title"]', title);
    await page.fill('input[id="servings"]', "4");

    // Add ingredient: 200 g Mehl
    await page.click('button:has-text("+ Zutat hinzufügen")');
    await page.locator('input[placeholder="Name"]').first().fill("Mehl");
    await page.locator('input[placeholder="Menge"]').first().fill("200");
    await page.locator('input[placeholder="Einheit"]').first().fill("g");

    // Add step
    await page.locator('textarea[placeholder*="Schritt"]').first().fill("Teig anrühren und goldbraun ausbacken.");

    // Save
    await page.click('button[type="submit"]:has-text("Speichern")');
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+/);

    // 2. Test Dynamic Servings Scaler
    // Initially 4 servings -> 200 g
    await expect(page.getByText("Mehl", { exact: true })).toBeVisible();
    await expect(page.locator("text=200 g")).toBeVisible();

    // Scale to 8 servings -> quantity should double to 400 g
    const servingsInput = page.locator('input[id="servings"]');
    await servingsInput.fill("8");
    await expect(page.locator("text=400 g")).toBeVisible();

    // Scale to 2 servings -> quantity should halve to 100 g
    await servingsInput.fill("2");
    await expect(page.locator("text=100 g")).toBeVisible();

    // 3. Test Mark as Cooked (Erprobt) toggle
    const cookedToggleBtn = page.locator('button:has-text("Als erprobt markieren"):visible').first();
    await expect(cookedToggleBtn).toBeVisible();
    await cookedToggleBtn.click();

    // Verification banner with "Erprobt & lecker" appears
    await expect(page.getByText("Erprobt & lecker").first()).toBeVisible();

    // Toggle off via "Erprobt-Status entfernen"
    const unmarkBtn = page.locator('button:has-text("Erprobt-Status entfernen"):visible').first();
    await expect(unmarkBtn).toBeVisible();
    await unmarkBtn.click();

    // "Als erprobt markieren" button reappears
    await expect(page.locator('button:has-text("Als erprobt markieren"):visible').first()).toBeVisible();

    // 4. Test Printable Recipe Card
    const printLink = page.locator('a[href*="/print"]:visible').first();
    await expect(printLink).toBeVisible();
    await printLink.click();

    // On print page
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+\/print/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // Verify printable card elements
    await expect(page.getByText("Zutaten").first()).toBeVisible();
    await expect(page.getByText("Mehl", { exact: true }).first()).toBeVisible();
    await expect(page.locator("button:has-text('Drucken')").first()).toBeVisible();
  });
});
