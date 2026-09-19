import { test, expect } from "@playwright/test";
import { createRandomUser, registerUser, loginUser } from "./helpers/auth";

test.describe("Authentication & Session Guards", () => {
  test("redirects unauthenticated users to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('input[id="email"]')).toBeVisible();
    await expect(page.locator('input[id="password"]')).toBeVisible();
  });

  test("shows error when logging in with invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[id="email"]', "nonexistent@example.com");
    await page.fill('input[id="password"]', "wrongpassword123");
    await page.click('button[type="submit"]');

    // Should display invalid credentials alert
    const errorAlert = page.locator(".text-destructive");
    await expect(errorAlert).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("registers a new account and can log out and log back in", async ({ page }) => {
    const user = createRandomUser();

    // 1. Register
    await registerUser(page, user);

    // Verify authenticated state
    await expect(page.locator('header nav a[href*="/recipes/new"]')).toBeVisible();

    // 2. Sign out
    const signOutBtn = page.locator('button[aria-label="Abmelden"], button[title="Abmelden"]');
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    // After sign out, should be on login page
    await page.waitForURL(/\/login/);
    await expect(page).toHaveURL(/\/login/);

    // 3. Log back in
    await loginUser(page, user);
    await expect(page.locator("header")).toBeVisible();
  });
});
