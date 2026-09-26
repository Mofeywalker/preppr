import { test, expect } from "@playwright/test";
import { registerUser } from "./helpers/auth";

test.describe("Recipe Sharing, Visibility & Forking Flow", () => {
  test("enforces private vs. shared recipe access, filter scopes, non-owner restrictions, and forking", async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    // 1. Setup two isolated user browser contexts
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await registerUser(pageA);

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await registerUser(pageB);

    const uid = Math.random().toString(36).substring(2, 8);
    const privateTitle = `Geheime Pasta ${uid}`;
    const sharedTitle = `Geteilter Salat ${uid}`;

    // 2. User A creates a PRIVATE recipe
    await pageA.click('header nav a[href*="/recipes/new"]');
    await pageA.waitForURL(/\/recipes\/new/);
    await pageA.fill('input[id="title"]', privateTitle);
    await pageA.selectOption('select[id="visibility"]', "private");
    await pageA.fill('input[id="servings"]', "2");

    // Add ingredient & step
    await pageA.click('button:has-text("+ Zutat hinzufügen")');
    await pageA.locator('input[placeholder="Name"]').first().fill("Knoblauch");
    await pageA.locator('textarea[placeholder*="Schritt"]').first().fill("Knoblauch anbraten");

    await pageA.click('button[type="submit"]:has-text("Speichern")');
    await pageA.waitForURL((url) => url.pathname.includes("/recipes/") && !url.pathname.endsWith("/new"));
    await expect(pageA.locator("h1")).toContainText(privateTitle);
    const privateRecipeUrl = pageA.url();
    const privateRecipeId = privateRecipeUrl.match(/\/recipes\/([^/?#]+)/)?.[1];
    expect(privateRecipeId).toBeTruthy();
    expect(privateRecipeId).not.toBe("new");

    // Verify User A sees the recipe and private badge
    await expect(pageA.getByText("Privat", { exact: false }).first()).toBeVisible();
    // 3. User A creates a SHARED recipe (default visibility)
    await pageA.click('header nav a[href*="/recipes/new"]');
    await pageA.waitForURL(/\/recipes\/new/);
    await pageA.fill('input[id="title"]', sharedTitle);
    await pageA.fill('input[id="servings"]', "4");

    await pageA.click('button:has-text("+ Zutat hinzufügen")');
    await pageA.locator('input[placeholder="Name"]').first().fill("Rucola");
    await pageA.locator('textarea[placeholder*="Schritt"]').first().fill("Rucola waschen");

    await pageA.click('button[type="submit"]:has-text("Speichern")');
    await pageA.waitForURL((url) => url.pathname.includes("/recipes/") && !url.pathname.endsWith("/new"));
    await expect(pageA.locator("h1")).toContainText(sharedTitle);
    const sharedRecipeUrl = pageA.url();
    const sharedRecipeId = sharedRecipeUrl.match(/\/recipes\/([^/?#]+)/)?.[1];
    expect(sharedRecipeId).toBeTruthy();
    expect(sharedRecipeId).not.toBe("new");

    await expect(pageA.getByText("Geteilt", { exact: false }).first()).toBeVisible();
    // 4. Verify User A sees both on their list
    await pageA.click('header nav a:has-text("Rezepte")');
    await pageA.waitForURL((url) => url.pathname === "/" || url.pathname === "/de" || url.pathname === "/en");
    await expect(pageA.getByText(privateTitle)).toBeVisible();
    await expect(pageA.getByText(sharedTitle)).toBeVisible();

    // 5. User B navigates to recipes list and checks visibility scopes
    await pageB.goto("/de");
    await pageB.waitForLoadState("domcontentloaded");

    // In "Alle": Shared recipe is visible, Private recipe MUST NOT be visible
    await expect(pageB.getByText(sharedTitle)).toBeVisible();
    await expect(pageB.getByText(privateTitle)).not.toBeVisible();

    // In "Geteilt": Shared recipe from User A is visible
    const sharedTabBtn = pageB.locator('button:has-text("Geteilt"):visible').first();
    await sharedTabBtn.click();
    await expect(pageB.getByText(sharedTitle)).toBeVisible();
    await expect(pageB.getByText(privateTitle)).not.toBeVisible();

    // In "Meine": Neither recipe is visible for User B
    const mineTabBtn = pageB.locator('button:has-text("Meine Rezepte"):visible, button:has-text("Meine"):visible').first();
    await mineTabBtn.click();
    await expect(pageB.getByText(sharedTitle)).not.toBeVisible();
    await expect(pageB.getByText(privateTitle)).not.toBeVisible();

    // 6. User B tries direct access to User A's private recipe -> MUST 404
    await pageB.goto(`/de/recipes/${privateRecipeId}`);
    await expect(pageB.getByRole("heading", { name: "404" })).toBeVisible();

    // 7. User B visits User A's shared recipe -> should see Fork button, no Delete button
    await pageB.goto(`/de/recipes/${sharedRecipeId}`);
    await expect(pageB.locator("h1")).toContainText(sharedTitle);

    const forkBtn = pageB.locator('button:has-text("In meine Rezepte kopieren"):visible').first();
    await expect(forkBtn).toBeVisible();

    // Open overflow menu on non-owned recipe: "Löschen" must NOT be present
    const overflowBtn = pageB.locator('button[aria-label="Weitere Aktionen"], button[aria-label="More actions"]').first();
    await overflowBtn.click();
    await expect(pageB.locator('button[role="menuitem"]:has-text("Löschen")')).not.toBeVisible();
    // Close overflow menu
    await pageB.keyboard.press("Escape");

    // 8. User B forks the recipe
    await forkBtn.click();

    // Redirects to User B's new recipe copy
    await pageB.waitForURL((url) => url.pathname.includes("/recipes/") && !url.pathname.includes(sharedRecipeId!));
    const forkedRecipeUrl = pageB.url();
    const forkedRecipeId = forkedRecipeUrl.match(/\/recipes\/([^/?#]+)/)?.[1];
    expect(forkedRecipeId).toBeTruthy();
    expect(forkedRecipeId).not.toBe(sharedRecipeId);

    // On User B's copy: Fork button is gone
    await expect(pageB.locator('button:has-text("In meine Rezepte kopieren")')).not.toBeVisible();

    // On User B's copy: User B is owner, so "Löschen" is present in overflow menu
    const forkedOverflowBtn = pageB.locator('button[aria-label="Weitere Aktionen"], button[aria-label="More actions"]').first();
    await forkedOverflowBtn.click();
    await expect(pageB.locator('button[role="menuitem"]:has-text("Löschen")')).toBeVisible();
    await pageB.keyboard.press("Escape");

    // 9. User B edits their copy
    const editLink = pageB.locator('a[href$="/edit"]:visible').first();
    await expect(editLink).toBeVisible();
    await editLink.click();
    await pageB.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+\/edit/);

    const updatedForkedTitle = `${sharedTitle} (Kopie B)`;
    await pageB.fill('input[id="title"]', updatedForkedTitle);
    await pageB.click('button[type="submit"]:has-text("Speichern")');

    await pageB.waitForURL(/\/recipes\/[a-zA-Z0-9_-]+$/);
    await expect(pageB.locator("h1")).toContainText(updatedForkedTitle);

    // 10. Verify isolation: User A's original is unchanged
    await pageA.goto(`/de/recipes/${sharedRecipeId}`);
    await expect(pageA.locator("h1")).toContainText(sharedTitle);
    await expect(pageA.getByText(updatedForkedTitle)).not.toBeVisible();

    // 11. User B's list reflects the forked recipe in "Meine" and original in "Geteilt"
    await pageB.goto("/de");
    const userBMineTab = pageB.locator('button:has-text("Meine Rezepte"):visible, button:has-text("Meine"):visible').first();
    await userBMineTab.click();
    await expect(pageB.getByText(updatedForkedTitle)).toBeVisible();

    const userBSharedTab = pageB.locator('button:has-text("Geteilt"):visible').first();
    await userBSharedTab.click();
    await expect(pageB.getByText(sharedTitle)).toBeVisible();

    // Cleanup
    await contextA.close();
    await contextB.close();
  });
});
