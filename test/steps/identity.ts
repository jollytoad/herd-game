import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { board, test } from "./fixtures.ts";

const { Given, When, Then } = createBdd(test);

/**
 * A player is recognised by the cookie their seat sets, scoped to one room.
 * Everything here is about which cookie is (or isn't) in play for a given page.
 */

When("I refresh the page", async ({ game }) => {
  await game.host.reload();
});

Then("I am still in the room", async ({ game }) => {
  // The join form appearing again would mean the seat was lost.
  await expect(board(game.host).locator(".big-code")).toHaveText(game.code);
});

Then("{string} is still in the room", async ({ game }, name: string) => {
  await expect(board(game.pageFor(name)).locator(".big-code")).toHaveText(game.code);
});

When("{string} opens a different room", async ({ game }, name: string) => {
  // Their cookie is `Path=/rooms/:CODE`, so it is not sent there and they are
  // put back on the join form rather than seated.
  const otherCode = await game.otherRoom();
  await game.pageFor(name).goto(`/rooms/${otherCode}`);
  await expect(game.pageFor(name).locator('input[name="name"]')).toBeVisible();
});

Then("{string} is asked to join instead", async ({ game }, name: string) => {
  const page = game.pageFor(name);
  await expect(page.locator(".big-code")).toBeVisible();
  await expect(page.locator('input[name="name"]')).toBeVisible();
});

Given("I am on the landing page", async ({ game }) => {
  await game.host.goto("/");
});

When("I try to join room {string}", async ({ game }, code: string) => {
  await game.tryJoinCode(code);
});

Then("I see the error {string}", async ({ game }, message: string) => {
  if (!game.lastRefused) throw new Error(`No join was refused — no error was shown`);
  await expect(game.lastRefused.locator(".error")).toHaveText(message);
});
