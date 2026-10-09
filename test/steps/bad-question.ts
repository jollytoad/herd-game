import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { test } from "./fixtures.ts";

const { When, Then } = createBdd(test);

/**
 * Rejecting a dud question. The threshold is `Math.ceil(players / 2)`
 * (src/views/asking.tsx) and each player counts once, so with 3 seated players
 * two distinct rejections throw the question away.
 */

When("the host calls bad question", async ({ game }) => {
  await game.reject(game.hostName);
});

When("{string} calls bad question", async ({ game }, name: string) => {
  await game.reject(name);
});

When("the host calls bad question again", async ({ game }) => {
  await game.reject(game.hostName, false);
});

Then("a different question is on the table", async ({ game }) => {
  // A rejected question is replaced from the deck, so the prompt must differ.
  expect(await game.question()).not.toBe(game.questionBeforeReject);
});

Then("the question is unchanged", async ({ game }) => {
  expect(await game.question()).toBe(game.questionBeforeReject);
});

Then("the reject count reads {string}", async ({ game }, count: string) => {
  expect(await game.rejectCount()).toBe(count);
});
