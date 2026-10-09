import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { board, test } from "./fixtures.ts";
import type { Game } from "./fixtures.ts";

const { Then } = createBdd(test);

/**
 * What a judged round did: the herd, who matched it, and who is holding the
 * pink cow. Shared by `herd-and-pink-cow` (which asserts exact outcomes, so
 * those scenarios are @mock) and `herd-invariants` (which asserts only rules
 * that hold under any judge, so those are @live).
 */

/** Every assertion in this file reads a judged round, and the host's board
 *  only reaches Results on the next SSE tick after the last answer — so an
 *  un-waited read sees the asking phase and finds no badges at all. */
async function settled(game: Game): Promise<void> {
  await game.waitForResult();
}

Then("the herd answer is {string}", async ({ game }, herd: string) => {
  await settled(game);
  // The banner wraps the answer in curly quotes.
  await expect(board(game.host).locator(".herd-banner .answer")).toHaveText(`“${herd}”`);
});

Then("there is no herd", async ({ game }) => {
  await settled(game);
  await expect(board(game.host).locator(".herd-banner.no-herd")).toBeVisible();
});

Then("{string} and {string} each gained a cow", async ({ game }, a: string, b: string) => {
  await settled(game);
  expect(await game.cows(a)).toBe(1);
  expect(await game.cows(b)).toBe(1);
});

Then("{string} gained a cow", async ({ game }, name: string) => {
  await settled(game);
  expect(await game.cows(name)).toBe(1);
});

Then("{string} has {int} cows", async ({ game }, name: string, count: number) => {
  await settled(game);
  expect(await game.cows(name)).toBe(count);
});

Then(
  "{string}, {string} and {string} all gained a cow",
  async ({ game }, a: string, b: string, c: string) => {
    await settled(game);
    for (const name of [a, b, c]) expect(await game.cows(name)).toBe(1);
  },
);

Then("{string} missed the herd", async ({ game }, name: string) => {
  await settled(game);
  // Not the badge text: a sole misser is badged "🐷 pink cow" rather than
  // "❌ missed" (src/views/results.tsx), so the badge cannot distinguish them.
  expect(await game.inHerd()).not.toContain(name);
  expect(await game.cows(name)).toBe(0);
});

Then("nobody gained a cow", async ({ game }) => {
  await settled(game);
  for (const [name, cows] of Object.entries(await game.allCows())) {
    expect(`${name}=${cows}`).toBe(`${name}=0`);
  }
});

Then("{string} holds the pink cow", async ({ game }, name: string) => {
  await settled(game);
  expect(await game.pinkHolder()).toBe(name);
  // The note is rendered per viewer, so only the holder's own board has it —
  // but only in the results phase; game over has no note.
  const view = board(game.pageFor(name));
  if (await view.locator(".answer-row").count()) {
    await expect(view.locator(".pinkcow-note")).toBeVisible();
  }
});

Then("{string} no longer holds the pink cow", async ({ game }, name: string) => {
  await settled(game);
  // Not "nobody holds it": in a later round somebody else can become the sole
  // misser and take the pink cow, which is exactly what happens here.
  expect(await game.pinkHolder()).not.toBe(name);
  await expect(board(game.pageFor(name)).locator(".pinkcow-note")).toHaveCount(0);
});

Then("nobody holds the pink cow", async ({ game }) => {
  await settled(game);
  expect(await game.pinkHolder()).toBeNull();
});

Then("nobody else holds the pink cow", async ({ game }) => {
  await settled(game);
  // Given the scenario has already established a holder, "nobody else" means
  // exactly one 🐷 marker on the scoreboard.
  await expect(board(game.host).locator(".score-row .pig")).toHaveCount(1);
});

Then("at most one player holds the pink cow", async ({ game }) => {
  await settled(game);
  expect(await board(game.host).locator(".score-row .pig").count()).toBeLessThanOrEqual(1);
});

Then("each player's cow count matches the result badges", async ({ game }) => {
  await settled(game);
  // One round from a fresh lobby, so holding a cow means exactly "was badged
  // in the herd". That makes the two independently-rendered views comparable.
  const badged = await game.inHerd();
  for (const [name, cows] of Object.entries(await game.allCows())) {
    expect(`${name}: cows=${cows}, inHerd=${badged.includes(name)}`)
      .toBe(`${name}: cows=${badged.includes(name) ? 1 : 0}, inHerd=${badged.includes(name)}`);
  }
});

Then("nobody badged as in the herd holds the pink cow", async ({ game }) => {
  await settled(game);
  // Matching the herd sheds the pink cow (src/game.ts `adjudicate`), so the
  // badge and the marker can never disagree.
  const holder = await game.pinkHolder();
  const badged = await game.inHerd();
  expect(holder === null || !badged.includes(holder)).toBe(true);
});
