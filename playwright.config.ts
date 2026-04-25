import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "e2e-results",
  testMatch: ["**/*.test.ts"],
  timeout: 60000,
  retries: 1,
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL: "http://localhost:8888",
    navigationTimeout: 45000,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "block",
  },
  webServer: {
    command: "npm start",
    port: 8888,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
