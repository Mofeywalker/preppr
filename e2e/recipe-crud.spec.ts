import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test.describe("Recipe Lifecycle (CRUD)", () => {
  test("creates, views, edits, and deletes a recipe", async ({ page }) => {
    // 1. Authenticate
    await registerUser(page);

    // 2. Navigate to new recipe page
    await page.click('header nav a[href*="/recipes/new"]');
    await expect(page).toHaveURL(/\/recipes\/new/);
    await expect(page.locator("h1")).toContainText("Neues Rezept");

    const uniqueId = Math.random().toString(36).substring(2, 8);
    const initialTitle = `Bolognese ${uniqueId}`;
    const updatedTitle = `Bolognese Spezial ${uniqueId}`;

    // 3. Fill recipe form
    await page.fill('input[id="title"]', initialTitle);
    await page.fill('textarea[id="description"]', "Ein herzhaftes Familienrezept für sonntags.");
    await page.fill('input[id="servings"]', "4");
    await page.fill('input[id="prep"]', "15");
    await page.fill('input[id="cook"]', "45");

    // Add Tag
    await page.fill('input[placeholder*="Tag eingeben"]', "Pasta");
    await page.click('button:has-text("+ Hinzufügen")');
    await expect(page.locator("span:has-text('Pasta')")).toBeVisible();

    // Ingredients
    const ingNameInputs = page.locator('input[placeholder="Name"]');
    const ingQtyInputs = page.locator('input[placeholder="Menge"]');
    const ingUnitInputs = page.locator('input[placeholder="Einheit"]');

    // Add 1st ingredient
    await page.click('button:has-text("+ Zutat hinzufügen")');
    await ingNameInputs.nth(0).fill("Spaghetti");
    await ingQtyInputs.nth(0).fill("500");
    await ingUnitInputs.nth(0).fill("g");

    // Add 2nd ingredient
    await page.click('button:has-text("+ Zutat hinzufügen")');
    await ingNameInputs.nth(1).fill("Rinderhackfleisch");
    await ingQtyInputs.nth(1).fill("400");
    await ingUnitInputs.nth(1).fill("g");

    // Add 3rd ingredient
    await page.click('button:has-text("+ Zutat hinzufügen")');
    await ingNameInputs.nth(2).fill("Tomaten");
    await ingQtyInputs.nth(2).fill("1");
    await ingUnitInputs.nth(2).fill("Dose");

    // Steps
    const stepInputs = page.locator('input[placeholder*="Schritt"]');
    await stepInputs.nth(0).fill("Zwiebeln und Hackfleisch scharf anbraten.");

    await page.click('button:has-text("+ Schritt hinzufügen")');
    await stepInputs.nth(1).fill("Tomaten hinzugeben und 30 Minuten köcheln lassen.");

    await page.click('button:has-text("+ Schritt hinzufügen")');
    await stepInputs.nth(2).fill("Spaghetti al dente kochen und servieren.");

    // Submit form
    await page.click('button[type="submit"]:has-text("Speichern")');

    // 4. Verify detail page
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+/);
    await expect(page.locator("h1")).toContainText(initialTitle);
    await expect(page.locator("text=#Pasta")).toBeVisible();
    await expect(page.getByText("Spaghetti", { exact: true })).toBeVisible();
    await expect(page.getByText("Rinderhackfleisch", { exact: true })).toBeVisible();
    await expect(page.locator("text=Zwiebeln und Hackfleisch scharf anbraten.")).toBeVisible();

    // 5. Edit recipe
    await page.click('a[href$="/edit"]');
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+\/edit/);

    await page.fill('input[id="title"]', updatedTitle);
    await page.click('button[type="submit"]:has-text("Speichern")');

    // Verify update
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+$/);
    await expect(page.locator("h1")).toContainText(updatedTitle);

    // 6. Delete recipe
    const deleteBtn = page.locator('button:has-text("Löschen"):visible');
    await deleteBtn.click();

    // Confirm dialog
    const confirmDialog = page.locator("dialog[open]");
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.locator('button:has-text("Löschen")').click();

    // Redirected to recipes home page
    await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/de" || url.pathname === "/en");
    await expect(page.getByText(updatedTitle)).not.toBeVisible();
  });
});
