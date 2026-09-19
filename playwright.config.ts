import { defineConfig, devices } from "@playwright/test";

const PORT = 3005;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60_000,
    env: {
      PORT: String(PORT),
      DATABASE_PATH: "./.test-e2e.db",
      BETTER_AUTH_SECRET: "test-better-auth-secret-super-safe-32-chars-long!",
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_TRUSTED_ORIGINS: `${BASE_URL},http://127.0.0.1:${PORT}`,
      APP_LOCALE: "de",
      DISABLE_RATE_LIMIT: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
