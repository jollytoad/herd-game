import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { board, test } from "./fixtures.ts";
import type { Strategy } from "./fixtures.ts";

const { When, Then } = createBdd(test);

/**
 * Eight cows without the pink cow wins. These scenarios play whole games, so
 * the loop is bounded: a strategy that keeps somebody stuck on the pink cow
 * never produces a winner, and the scenario then asserts the game is still
 * running rather than hanging.
 */

/** Everyone says the same thing: every round forms a herd, nobody goes pink. */
const AGREE: Strategy = (_round, names) => Object.fromEntries(names.map((n) => [n, "pizza"]));

/** One player always answers alone, so they are always the sole misser and so
 *  always the one the pink cow goes to. */
function leavingAlone(outsider: string): Strategy {
  return (_round, names) =>
    Object.fromEntries(
      names.map((n) => [n, n === outsider ? "sushi" : "pizza"]),
    );
}

When(
  "the room plays until someone reaches {int} cows, with everyone agreeing",
  async ({ game }, target: number) => {
    await game.playUntilCows(AGREE, target);
  },
);

When(
  "the room plays until someone reaches {int} cows, always leaving {string} alone",
  async ({ game }, target: number, outsider: string) => {
    await game.playUntilCows(leavingAlone(outsider), target);
  },
);

Then("the game is over", async ({ game }) => {
  expect(await game.isGameOver()).toBe(true);
});

Then("{string} is not announced as the winner", async ({ game }, name: string) => {
  const winners = board(game.host).locator(".winners");
  await expect(winners).toBeVisible();
  await expect(winners).not.toContainText(name);
});

Then("the winner is announced", async ({ game }) => {
  const winners = board(game.host).locator(".winners");
  await expect(winners).toBeVisible();
  await expect(winners).toContainText("wins!");
});

When("the host resets the game", async ({ game }) => {
  await game.playAgain();
});

Then("the room is back in the lobby", async ({ game }) => {
  // The lobby is the only phase that shows a room code and an add-bot button.
  await expect(board(game.host).locator(".big-code")).toHaveText(game.code);
  await expect(board(game.host).getByRole("button", { name: "Add bot player" })).toBeVisible();
});

Then("everybody's cow count is 0", async ({ game }) => {
  for (const [name, cows] of Object.entries(await game.allCows())) {
    expect(`${name}=${cows}`).toBe(`${name}=0`);
  }
});
