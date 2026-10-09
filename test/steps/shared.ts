import { expect } from "@playwright/test";
import { createBdd, DataTable } from "playwright-bdd";
import { board, test } from "./fixtures.ts";

const { Given, When, Then } = createBdd(test);

/**
 * Setup and play steps shared by round-lifecycle, herd-and-pink-cow,
 * herd-invariants, bad-question, win-and-reset and smoke. Every one of those
 * features begins from a full room with the timer off, so the setup lives here
 * rather than being repeated six times.
 */

Given("a room of {int} players with the timer set to no limit", async ({ game }, count: number) => {
  await game.fillRoom(count);
});

When("I set the timer to no limit", async ({ game }) => {
  await game.setTimer(0);
});

When("I start the game", async ({ game }) => {
  await game.start();
});

When("everyone answers:", async ({ game }, table: DataTable) => {
  const answers: Record<string, string> = {};
  for (const [name, answer] of table.raw()) answers[name.trim()] = answer.trim();
  await game.answerAll(answers);
});

When("the host opens the next round", async ({ game }) => {
  await game.openNextRound();
});

Then("the host sees the round result", async ({ game }) => {
  await game.waitForResult();
});

Then("the host sees the round {int} result", async ({ game }, round: number) => {
  await game.waitForResult();
  expect(await game.resolvedRounds()).toContain(round);
});

/** Everybody the room has, for scenarios that speak of "the room". */
Then("every player has a score", async ({ game }) => {
  // Counted, not compared: on a live judge the herd answer is free text, so
  // which players score is unknowable. What must hold is that every seat is
  // rendered with a numeric count.
  const rows = board(game.host).locator(".score-row");
  await expect(rows).toHaveCount(game.names().length);
  for (const name of game.names()) {
    await expect(rows.filter({ hasText: name }).locator(".cows b")).toHaveText(/^\d+$/);
  }
});
