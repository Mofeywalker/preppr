import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test.describe("Recipe Import Flow", () => {
  test("imports recipe via Preppr JSON paste and saves it", async ({ page }) => {
    // 1. Authenticate
    await registerUser(page);

    // 2. Navigate to import page
    await page.click('header nav a[href*="/import"]');
    await page.waitForURL(/\/import/);
    await expect(page.locator("h1")).toContainText("Rezepte importieren");

    // 3. Switch to Preppr tab
    const prepprTabBtn = page.locator('button:has-text("Preppr")');
    await expect(prepprTabBtn).toBeVisible();
    await prepprTabBtn.click();

    // 4. Paste valid recipe JSON into the textarea
    const uid = Math.random().toString(36).substring(2, 7);
    const importedTitle = `Avocado Toast Deluxe ${uid}`;

    const recipeJson = JSON.stringify({
      title: importedTitle,
      description: "Knuspriges Sauerteigbrot mit cremiger Avocado und pochiertem Ei.",
      servings: 2,
      prepTimeMin: 10,
      cookTimeMin: 5,
      language: "de",
      ingredients: [
        { name: "Sauerteigbrot", quantity: 2, unit: "Scheiben" },
        { name: "Reife Avocado", quantity: 1, unit: "Stück" },
        { name: "Eier", quantity: 2, unit: "Stück" },
      ],
      steps: [
        "Brot im Toaster oder in der Pfanne goldbraun anrösten.",
        "Avocado zerdrücken und mit Salz und Zitronensaft abschmecken.",
        "Eier pochieren und auf dem Toast servieren.",
      ],
    }, null, 2);

    const jsonTextarea = page.locator('textarea[id="pasted-json"]');
    await jsonTextarea.fill(recipeJson);

    // Verify valid badge appears
    await expect(page.locator("text=Gültiges JSON")).toBeVisible();

    // 5. Submit import form to load into review
    await page.click('button[type="submit"]:has-text("JSON importieren")');

    // 6. Review form should appear with prefilled title and ingredients
    await expect(page.locator('input[id="title"]')).toHaveValue(importedTitle);
    await expect(page.locator('input[value="Sauerteigbrot"]')).toBeVisible();
    await expect(page.locator('input[value="Reife Avocado"]')).toBeVisible();

    // 7. Save imported recipe
    await page.click('button[type="submit"]:has-text("Speichern")');

    // 8. Redirected to recipe detail page
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+/);
    await expect(page.locator("h1")).toContainText(importedTitle);
    await expect(page.getByText("Sauerteigbrot", { exact: true })).toBeVisible();
    await expect(page.getByText("Reife Avocado", { exact: true })).toBeVisible();
    await expect(page.locator("text=Brot im Toaster oder in der Pfanne goldbraun anrösten.")).toBeVisible();
  });
});
