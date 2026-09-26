import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test.describe("Recipe Ingredient Sections & Dual-View Flow", () => {
  test("creates recipe with multiple sections, tests section view and consolidated list, checklist, and print view", async ({
    page,
  }) => {
    // 1. Authenticate
    await registerUser(page);

    // 2. Navigate to recipe creation form
    await page.click('header nav a[href*="/recipes/new"]');
    await expect(page).toHaveURL(/\/recipes\/new/);

    const uid = Math.random().toString(36).substring(2, 8);
    const title = `Himbeer-Muffins mit Streuseln ${uid}`;

    await page.fill('input[id="title"]', title);
    await page.fill('input[id="servings"]', "12");

    // 3. Add section: Click "+ Abschnitt hinzufügen"
    const addSectionBtn = page.locator('button[data-testid="add-section-btn"]');
    await expect(addSectionBtn).toBeVisible();
    await addSectionBtn.click();

    // Now two section blocks exist
    const sectionBlocks = page.locator('[data-testid="recipe-form-section"]');
    await expect(sectionBlocks).toHaveCount(2);

    // Fill Section 1: "Teig"
    const sec1Name = sectionBlocks.nth(0).locator('input[data-testid="section-name-input"]');
    await sec1Name.fill("Teig");

    // Section 1 - Ingredient 1: 250 g Mehl
    const sec1Ings = sectionBlocks.nth(0);
    await sec1Ings.locator('input[placeholder="Name"]').first().fill("Mehl");
    await sec1Ings.locator('input[placeholder="Menge"]').first().fill("250");
    await sec1Ings.locator('input[placeholder="Einheit"]').first().fill("g");

    // Section 1 - Add Ingredient 2: 160 g Zucker
    await sec1Ings.locator('button:has-text("+ Zutat hinzufügen")').click();
    await sec1Ings.locator('input[placeholder="Name"]').nth(1).fill("Zucker");
    await sec1Ings.locator('input[placeholder="Menge"]').nth(1).fill("160");
    await sec1Ings.locator('input[placeholder="Einheit"]').nth(1).fill("g");

    // Section 1 - Add Ingredient 3: 80 g Butter
    await sec1Ings.locator('button:has-text("+ Zutat hinzufügen")').click();
    await sec1Ings.locator('input[placeholder="Name"]').nth(2).fill("Butter");
    await sec1Ings.locator('input[placeholder="Menge"]').nth(2).fill("80");
    await sec1Ings.locator('input[placeholder="Einheit"]').nth(2).fill("g");

    // Fill Section 2: "Streusel"
    const sec2Name = sectionBlocks.nth(1).locator('input[data-testid="section-name-input"]');
    await sec2Name.fill("Streusel");

    // Section 2 - Ingredient 1: 100 g Mehl
    const sec2Ings = sectionBlocks.nth(1);
    await sec2Ings.locator('input[placeholder="Name"]').first().fill("Mehl");
    await sec2Ings.locator('input[placeholder="Menge"]').first().fill("100");
    await sec2Ings.locator('input[placeholder="Einheit"]').first().fill("g");

    // Section 2 - Add Ingredient 2: 80 g Zucker
    await sec2Ings.locator('button:has-text("+ Zutat hinzufügen")').click();
    await sec2Ings.locator('input[placeholder="Name"]').nth(1).fill("Zucker");
    await sec2Ings.locator('input[placeholder="Menge"]').nth(1).fill("80");
    await sec2Ings.locator('input[placeholder="Einheit"]').nth(1).fill("g");

    // Section 2 - Add Ingredient 3: 60 g Butter
    await sec2Ings.locator('button:has-text("+ Zutat hinzufügen")').click();
    await sec2Ings.locator('input[placeholder="Name"]').nth(2).fill("Butter");
    await sec2Ings.locator('input[placeholder="Menge"]').nth(2).fill("60");
    await sec2Ings.locator('input[placeholder="Einheit"]').nth(2).fill("g");

    // Add Step
    await page
      .locator('textarea[placeholder*="Schritt"]')
      .first()
      .fill("Teig anrühren, Streusel verkneten und 25 Minuten backen.");

    // 4. Save recipe
    await page.click('button[type="submit"]:has-text("Speichern")');
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+/);

    // 5. Verify Recipe Detail Page in Section View (default)
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    const headers = page.locator('[data-testid="ingredient-section-header"]');
    await expect(headers).toHaveCount(2);
    await expect(headers.nth(0)).toContainText("Teig");
    await expect(headers.nth(1)).toContainText("Streusel");

    // Check individual ingredient amounts in section view
    await expect(page.locator("text=250 g").first()).toBeVisible();
    await expect(page.locator("text=100 g").first()).toBeVisible();

    // 6. Test Dual-View Toggle: Switch to Consolidated List (Gesamtliste)
    const toggleContainer = page.locator('[data-testid="ingredient-view-toggle"]');
    await expect(toggleContainer).toBeVisible();

    const consolidatedBtn = toggleContainer.locator('button:has-text("Gesamtliste")');
    await consolidatedBtn.click();

    // In consolidated view, Mehl (250g + 100g) should equal 350 g!
    await expect(page.locator("text=350 g")).toBeVisible();
    // Zucker (160g + 80g) should equal 240 g!
    await expect(page.locator("text=240 g")).toBeVisible();
    // Butter (80g + 60g) should equal 140 g!
    await expect(page.locator("text=140 g")).toBeVisible();

    // Check breakdown line mentions Teig and Streusel
    const breakdowns = page.locator('[data-testid="consolidated-breakdown"]');
    await expect(breakdowns.first()).toBeVisible();
    await expect(breakdowns.first()).toContainText("Teig");
    await expect(breakdowns.first()).toContainText("Streusel");

    // Switch back to "Nach Abschnitten"
    const sectionViewBtn = toggleContainer.locator('button:has-text("Nach Abschnitten")');
    await sectionViewBtn.click();
    await expect(headers.nth(0)).toContainText("Teig");
    await expect(headers.nth(1)).toContainText("Streusel");

    // 7. Test Interactive Checklist: Click to check an ingredient
    const firstIngRow = page.locator('[data-testid="ingredient-row"]').first();
    await expect(firstIngRow).toHaveAttribute("aria-checked", "false");
    await firstIngRow.click();
    await expect(firstIngRow).toHaveAttribute("aria-checked", "true");
    await expect(firstIngRow.locator("text=✓")).toBeVisible();

    // 8. Test Print / Recipe Card View
    const printLink = page.locator('a[href*="/print"]:visible').first();
    await expect(printLink).toBeVisible();
    await printLink.click();

    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+\/print/);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // Print card must display the section titles
    await expect(page.getByText("Teig").first()).toBeVisible();
    await expect(page.getByText("Streusel").first()).toBeVisible();

    // 9. Test Edit Flow: Navigate back to edit page and verify sections remain
    await page.goBack();
    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+/);

    const editLink = page.locator('a[href*="/edit"]:visible').first();
    await expect(editLink).toBeVisible();
    await editLink.click();

    await page.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+\/edit/);
    const editSectionBlocks = page.locator('[data-testid="recipe-form-section"]');
    await expect(editSectionBlocks).toHaveCount(2);
    await expect(
      editSectionBlocks.nth(0).locator('input[data-testid="section-name-input"]'),
    ).toHaveValue("Teig");
    await expect(
      editSectionBlocks.nth(1).locator('input[data-testid="section-name-input"]'),
    ).toHaveValue("Streusel");
  });
});
