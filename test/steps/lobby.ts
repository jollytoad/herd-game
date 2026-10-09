import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { test } from "./fixtures.ts";

// No `But`: createBdd returns Given/When/Then/Step only. The keyword is
// semantic anyway — `matchKeywords` is off, so `Then` serves a `But` step.
const { Given, When, Then } = createBdd(test);

/** Everything a player sees lives in the board, which htmx morphs in place. */
function board(page: Page) {
  return page.locator("#board");
}

Given("I am the host of a new room", async ({ game }) => {
  await game.createRoom("host");
});

When("{string} joins", async ({ game }, name: string) => {
  await game.join(name);
  await expect(board(game.pageFor(name)).locator(".big-code")).toHaveText(game.code);
});

When("{string} tries to join again", async ({ game }, name: string) => {
  await game.join(name);
});

Then("{string} sees the error {string}", async ({ game }, name: string, message: string) => {
  if (!game.lastRefused) throw new Error(`"${name}" was not refused — no error was shown`);
  await expect(game.lastRefused.locator(".error")).toHaveText(message);
});

When("I add a bot player", async ({ game }) => {
  await board(game.host).getByRole("button", { name: "Add bot player" }).click();
  await expect(board(game.host).locator(".chips .chip")).toHaveCount(2);
});

Then("the room has {int} players", async ({ game }, count: number) => {
  await expect(board(game.host).locator(".chips .chip")).toHaveCount(count);
});

Then("the bot is marked as a bot", async ({ game }) => {
  await expect(board(game.host).locator(".chips .chip").last()).toContainText("🤖");
});
Then("the start button becomes enabled", async ({ game }) => {
  await expect(board(game.host).getByRole("button", { name: "Start game" })).toBeEnabled();
});

Then("I see the start control", async ({ game }) => {
  // Presence, not clickability: with 2 players `canStart` is false, so the
  // button renders disabled. This scenario is about who sees the controls.
  await expect(board(game.host).getByRole("button", { name: "Start game" })).toBeVisible();
});

Then("{string} waits for the host to start", async ({ game }, name: string) => {
  await expect(board(game.pageFor(name))).toContainText("Waiting for the host to start");
});

Then("{string} cannot add a bot", async ({ game }, name: string) => {
  // A non-host is never sent the button at all — not sent it disabled.
  await expect(board(game.pageFor(name)).getByRole("button", { name: "Add bot player" }))
    .toHaveCount(0);
});
