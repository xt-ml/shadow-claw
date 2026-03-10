import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "e2e-results",
  testMatch: ["**/*.test.mjs"],
  timeout: 30000,
  use: {
    baseURL: "http://localhost:8888",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm start",
    port: 8888,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
