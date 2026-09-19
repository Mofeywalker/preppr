import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test.describe("Search, Filter & Tag Discovery", () => {
  test("searches by query and filters by tag chips", async ({ page }) => {
    // 1. Authenticate
    await registerUser(page);

    const uid = Math.random().toString(36).substring(2, 7);
    const pastaTitle = `Zitronen Pasta ${uid}`;
    const dessertTitle = `Schoko Tarte ${uid}`;

    // 2. Create Recipe A (Pasta)
    await page.click('header nav a[href*="/recipes/new"]');
    await page.fill('input[id="title"]', pastaTitle);
    await page.fill('input[placeholder*="Tag eingeben"]', `TagPasta${uid}`);
    await page.click('button:has-text("+ Hinzufügen")');
    await page.click('button:has-text("+ Zutat hinzufügen")');
    await page.locator('input[placeholder="Name"]').first().fill("Penne");
    await page.locator('input[placeholder*="Schritt"]').first().fill("Pasta kochen");
    await page.click('button[type="submit"]:has-text("Speichern")');
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+/);

    // 3. Create Recipe B (Dessert)
    await page.click('header nav a[href*="/recipes/new"]');
    await page.fill('input[id="title"]', dessertTitle);
    await page.fill('input[placeholder*="Tag eingeben"]', `TagDessert${uid}`);
    await page.click('button:has-text("+ Hinzufügen")');
    await page.click('button:has-text("+ Zutat hinzufügen")');
    await page.locator('input[placeholder="Name"]').first().fill("Schokolade");
    await page.locator('input[placeholder*="Schritt"]').first().fill("Kuchen backen");
    await page.click('button[type="submit"]:has-text("Speichern")');
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+/);

    // 4. Go to home page
    await page.click('header nav a:has-text("Rezepte")');
    await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/de" || url.pathname === "/en");

    // Both recipes should initially be visible
    await expect(page.getByText(pastaTitle)).toBeVisible();
    await expect(page.getByText(dessertTitle)).toBeVisible();

    // 5. Test Instant Search (Fuse.js)
    const searchInput = page.locator('input[type="search"]');
    await searchInput.fill("Zitrone");

    await expect(page.getByText(pastaTitle)).toBeVisible();
    await expect(page.getByText(dessertTitle)).not.toBeVisible();

    // Clear search
    await searchInput.fill("");
    await expect(page.getByText(pastaTitle)).toBeVisible();
    await expect(page.getByText(dessertTitle)).toBeVisible();

    // 6. Test Tag Chip Filtering
    const dessertTagBtn = page.locator(`button.rounded-full:has-text("TagDessert${uid}")`);
    await expect(dessertTagBtn).toBeVisible();
    await dessertTagBtn.click();

    // Only Dessert recipe should be visible
    await expect(page.getByText(dessertTitle)).toBeVisible();
    await expect(page.getByText(pastaTitle)).not.toBeVisible();

    // Reset with "Alle Tags"
    const allTagsBtn = page.locator('button.rounded-full:has-text("Alle Tags")');
    await allTagsBtn.click();

    await expect(page.getByText(pastaTitle)).toBeVisible();
    await expect(page.getByText(dessertTitle)).toBeVisible();
  });
});
