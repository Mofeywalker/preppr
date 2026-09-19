import { type Page, expect } from "@playwright/test";

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export function createRandomUser(): TestUser {
  const id = Math.random().toString(36).substring(2, 10);
  return {
    name: `Test User ${id}`,
    email: `test-${id}@example.com`,
    password: "Password123!",
  };
}

export async function registerUser(page: Page, user: TestUser = createRandomUser()): Promise<TestUser> {
  await page.goto("/register");
  await expect(page).toHaveURL(/\/register/);
  await page.waitForLoadState("domcontentloaded");

  await page.fill('input[id="name"]', user.name);
  await page.fill('input[id="email"]', user.email);
  await page.fill('input[id="password"]', user.password);
  await page.click('button[type="submit"]');

  // After registration, user is redirected to the home page "/"
  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/de" || url.pathname === "/en");
  await expect(page.locator("header")).toBeVisible();

  return user;
}

export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
  await page.waitForLoadState("domcontentloaded");

  await page.fill('input[id="email"]', user.email);
  await page.fill('input[id="password"]', user.password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => url.pathname === "/" || url.pathname === "/de" || url.pathname === "/en");
  await expect(page.locator("header")).toBeVisible();
}
