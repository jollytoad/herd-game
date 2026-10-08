import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

/**
 * `process.env` rather than `Deno.env` so this file also loads under the
 * `npx playwright-bdd` fallback. Both runtimes provide it.
 */
const baseURL = process.env.HERD_BASE_URL ?? "http://localhost:8000";

/**
 * Returns the directory bddgen writes generated specs into — that return value
 * is the whole point of the call, and it must become `testDir` below. Without
 * it Playwright collects nothing.
 */
const testDir = defineBddConfig({
  features: ["test/features/**/*.feature"],
  steps: ["test/steps/**/*.steps.ts"],
  outputDir: "playwright-bdd-gen",
  // Tag filtering happens at generation time, so it belongs here and not on the
  // `playwright test` command line. Set BDD_TAGS to a tag expression, e.g.
  // BDD_TAGS='@mock and not @live' deno task test:e2e
  tags: process.env.BDD_TAGS || undefined,
});

export default defineConfig({
  testDir,
  use: {
    baseURL,
    timeout: 30_000,
    // Runs are manual, so `retries` is 0 and `on-first-retry` would never fire.
    // This records every test but only keeps the trace for failures.
    trace: "retain-on-failure",
    // Harmless over plain HTTP. Matters the moment `deno task dev` finds a
    // localhost-key.pem (mkcert) and host-deno-local flips it to HTTPS — a
    // self-signed cert would otherwise fail every navigation.
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
