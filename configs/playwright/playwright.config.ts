import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "../..");

export default defineConfig({
  testDir: resolve(projectRoot, "e2e"),
  outputDir: resolve(projectRoot, "e2e-results"),
  testMatch: ["**/*.test.ts"],
  timeout: 60000,
  retries: 1,
  workers: process.env.CI ? 2 : 4,
  use: {
    baseURL: "http://localhost:8888",
    navigationTimeout: 45000,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    serviceWorkers: "allow",
  },
  webServer: {
    command: "npm start",
    cwd: projectRoot,
    port: 8888,
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      ...process.env,
      SHADOWCLAW_DATABASE_DIR: ".cache/e2e-database",
    },
  },
});
