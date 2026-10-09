import { expect } from "@playwright/test";
import { createBdd } from "playwright-bdd";
import { board, test } from "./fixtures.ts";

const { When, Then } = createBdd(test);

/** The shape of a round: asked, answered, judged, and who may open the next. */

Then("everyone is asked round {int}'s question", async ({ game }, round: number) => {
  for (const name of game.names()) {
    const view = board(game.pageFor(name));
    await expect(view.locator(".round-head")).toContainText(`Round ${round}`);
    // A question is drawn from the deck; an empty one would mean the flip
    // happened but the prompt did not.
    await expect(view.locator(".qcard")).not.toHaveText("");
  }
});

Then("nobody has answered yet", async ({ game }) => {
  // The asking chips read `name ✅` once answered and `name …` until then.
  await expect(board(game.host).locator(".chips .chip", { hasText: "✅" })).toHaveCount(0);
});

When("{string} answers {string}", async ({ game }, name: string, answer: string) => {
  await game.answer(name, answer);
});

Then("{string} has locked in", async ({ game }, name: string) => {
  await expect(board(game.pageFor(name))).toContainText("Locked in");
});

Then("the board shows {string} has answered", async ({ game }, name: string) => {
  await expect(board(game.host).locator(".chips .chip").filter({ hasText: name }))
    .toContainText("✅");
});

Then("the host is offered the next round", async ({ game }) => {
  await game.waitForResult();
  await expect(board(game.host).getByRole("button", { name: "Next round" })).toBeVisible();
});

Then("{string} is waiting for the host to start the next round", async ({ game }, name: string) => {
  await expect(board(game.pageFor(name)))
    .toContainText("Waiting for the host to start the next round");
});

Then("{string} can no longer lock in an answer", async ({ game }, name: string) => {
  // Once judged, the asking form is gone rather than merely disabled.
  await game.waitForResult();
  await expect(board(game.pageFor(name)).locator('input[name="answer"]')).toHaveCount(0);
});
