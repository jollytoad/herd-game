import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";

/**
 * `createBdd()` with no arguments gives Playwright-style steps backed by the
 * default `test`. Step functions take Playwright fixtures first, then the
 * arguments captured from the pattern — no `this`, no World.
 *
 * Keyword is semantic only: `matchKeywords` is off by default, so a step
 * registered here can be used as Given, When, or Then in a .feature file.
 */
const { When, Then } = createBdd();

When("I visit the landing page", async ({ page }) => {
  // Relative to `use.baseURL`, so this follows HERD_BASE_URL to whichever
  // deployment is under test.
  await page.goto("/");
});

Then("I see the {string} card", async ({ page }, title: string) => {
  // Quotes in the .feature file are how you pass an argument, not literal text:
  // `Then I see the "Create a room" card` hands us "Create a room".
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});

Then("I see the rules", async ({ page }) => {
  await expect(page.locator(".rules-blurb")).toBeVisible();
});
