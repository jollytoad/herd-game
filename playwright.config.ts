import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

const baseURL = process.env.HERD_BASE_URL ?? "http://localhost:8000";

const testDir = defineBddConfig({
  features: ["test/features/*.feature"],
  steps: ["test/steps/*.ts"],
  outputDir: "playwright-bdd-gen",
});

export default defineConfig({
  testDir,
  use: {
    baseURL,
    timeout: 30_000,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
