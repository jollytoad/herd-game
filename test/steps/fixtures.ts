/**
 * Shared fixtures for room scenarios.
 *
 * `test` is extended from `playwright-bdd` — NOT from `@playwright/test` — and
 * the instance is exported because generated specs import it. bddgen only
 * registers exported test instances from files matched by the `steps` glob, so
 * this file has to live under `test/steps/`.
 *
 * State lives here rather than in the step functions because it has to survive
 * across steps: the code read during `Given I am the host of a new room` is
 * needed by every join after it, a seat's page exists only as a result of its
 * join, and `win-and-reset` needs the per-round history of a whole game.
 */
import { test as base } from "playwright-bdd";
import { expect } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

/** WIN_COWS in src/rooms.ts. */
const WIN_COWS = 8;

/** Names used to fill a room of N. Long enough for MAX_PLAYERS (12). */
const ROSTER = [
  "dave",
  "eve",
  "frank",
  "grace",
  "heidi",
  "ivan",
  "judy",
  "ken",
  "lara",
  "mike",
  "nina",
  "oscar",
];

/** Rounds of adjudication ride the 1s SSE tick, so a resolved round can take a
 *  couple of seconds to reach every page. */
const ROUND_TIMEOUT = 20_000;

/** One seated player: their own context, because identity is a room-scoped
 *  `HttpOnly` cookie (`Path=/rooms/:CODE`) and a shared context would have one
 *  seat overwrite the other's. */
export type Seat = {
  name: string;
  context: BrowserContext;
  page: Page;
};

/** What one resolved round looked like, read off the host's board. */
export type RoundRecord = {
  round: number;
  herd: string | null;
  inHerd: string[];
  pinkHolder: string | null;
  cows: Record<string, number>;
};

/** How `playUntilCows` decides what each player says in a given round. */
export type Strategy = (round: number, names: string[]) => Record<string, string>;

export class Game {
  code = "";
  hostName = "";
  /** The page shown the most recent refused join, so the next step can assert
   *  on the error it was given. */
  lastRefused: Page | null = null;
  /** The question on the table before the most recent reject click. */
  questionBeforeReject = "";
  /** The reject tally before the most recent reject click. */
  rejectsBefore = "";
  /** One entry per resolved round, in order. */
  history: RoundRecord[] = [];

  private readonly seats = new Map<string, Seat>();
  private readonly contexts: BrowserContext[] = [];
  private readonly browser: Browser;
  private readonly hostPage: Page;
  /** `use` options are not inherited by `browser.newContext()`, so they are
   *  read off the project and passed through per seat. Without this a seat
   *  silently loses `ignoreHTTPSErrors` and fails against a TLS deploy. */
  private readonly contextOptions: { ignoreHTTPSErrors?: boolean };

  constructor(
    browser: Browser,
    hostPage: Page,
    contextOptions: { ignoreHTTPSErrors?: boolean },
  ) {
    this.browser = browser;
    this.hostPage = hostPage;
    this.contextOptions = contextOptions;
  }

  // -------------------------------------------------------------------------
  // Pages
  // -------------------------------------------------------------------------

  /** The host plays in the default `page` fixture — no extra context needed. */
  get host(): Page {
    return this.hostPage;
  }

  /** Everyone seated, host first. */
  names(): string[] {
    return [this.hostName, ...[...this.seats.keys()]];
  }

  /** The page a named player is looking at. Steps say `"dave"`, never "the
   *  host", so the host is reachable by name too. */
  pageFor(name: string): Page {
    if (name === this.hostName) return this.hostPage;
    const seat = this.seats.get(name);
    if (!seat) throw new Error(`No seat for "${name}" — join them before asserting on them`);
    return seat.page;
  }

  /** A page in a fresh context that holds no seat — for bystanders who only
   *  need to exist, such as the owner of a second room. */
  async bystander(): Promise<Page> {
    const context = await this.browser.newContext(this.contextOptions);
    this.contexts.push(context);
    return await context.newPage();
  }

  /** Submits the landing page's join form for `code`. Uses the host's own
   *  page: the seat cookie is `Path=/rooms/:CODE`, so a failed join against
   *  another code leaves the host's seat in room A untouched. */
  async tryJoinCode(code: string): Promise<void> {
    await this.hostPage.goto("/");
    // The landing page has two forms; the join one is the one with a "Join"
    // button. Its code field is `maxlength=4`, so `fill` — which assigns the
    // value rather than typing it — is what lets a deliberately malformed code
    // through to the server.
    const form = this.hostPage.locator("form").filter({
      has: this.hostPage.getByRole("button", { name: "Join" }),
    });
    await form.locator('input[name="code"]').fill(code);
    await form.locator('input[name="name"]').fill("wanderer");
    await form.getByRole("button", { name: "Join" }).click();
    await this.hostPage.locator("#board, .error").first().waitFor();
    this.lastRefused = await this.hostPage.locator(".error").count() ? this.hostPage : null;
  }

  /** Creates a second room from an unseat bystander and returns its code. */
  async otherRoom(): Promise<string> {
    const page = await this.bystander();
    await page.goto("/");
    const form = page.locator("form").filter({
      has: page.getByRole("button", { name: "Create room" }),
    });
    await form.locator('input[name="name"]').fill("bystander");
    await form.getByRole("button", { name: "Create room" }).click();
    return (await page.locator(".big-code").innerText()).trim();
  }

  private async freshSeat(name: string): Promise<Seat> {
    const context = await this.browser.newContext(this.contextOptions);
    this.contexts.push(context);
    return { name, context, page: await context.newPage() };
  }

  // -------------------------------------------------------------------------
  // Room setup
  // -------------------------------------------------------------------------

  /** Creates the room through the landing page's "Create a room" form.
   *
   *  That form is `hx-boost`, so the POST is an XHR that swaps HTML in and
   *  leaves the address bar at `/` — the code has to be read off the board,
   *  not from `page.url()`. */
  async createRoom(hostName: string): Promise<void> {
    this.hostName = hostName;
    this.resetState();
    await this.hostPage.goto("/");
    // Both landing forms have an `input[name=name]`, so the card is picked out
    // by its button rather than by position.
    const form = this.hostPage.locator("form").filter({
      has: this.hostPage.getByRole("button", { name: "Create room" }),
    });
    await form.locator('input[name="name"]').fill(hostName);
    await form.getByRole("button", { name: "Create room" }).click();
    this.code = (await this.hostPage.locator(".big-code").innerText()).trim();
  }

  /** Walks `name` through the join form for the current room.
   *
   *  An unseated visitor to `/rooms/:CODE` is shown the join page, which has
   *  exactly one `input[name=name]` — unlike the landing page's two. A refused
   *  join re-renders that page with `.error`, so success and refusal are told
   *  apart by which of the two appeared. */
  async join(name: string): Promise<void> {
    // Deliberately a NEW context even when the name already holds a seat: that
    // seat's cookie would carry them straight into the room, which is the
    // opposite of what a duplicate-name attempt needs to test.
    const attempt = await this.freshSeat(name);
    await attempt.page.goto(`/rooms/${this.code}`);
    await attempt.page.locator('input[name="name"]').fill(name);
    await attempt.page.getByRole("button", { name: "Join" }).click();
    await attempt.page.locator("#board, .error").first().waitFor();
    if (await attempt.page.locator(".error").count()) {
      this.lastRefused = attempt.page;
      return;
    }
    this.lastRefused = null;
    this.seats.set(name, attempt);
  }

  /** Fills a room with `count` players from ROSTER and turns the timer off.
   *
   *  The LAST player seated is the host. That is not cosmetic: every player has
   *  to answer for a round to resolve (src/game.ts `maybeEndRound`), so a host
   *  outside the roster would leave the round permanently unresolvable. Making
   *  the host the last seat also keeps them distinct from "dave", which
   *  bad-question relies on to put two distinct rejections on one question. */
  async fillRoom(count: number): Promise<void> {
    const names = ROSTER.slice(0, count);
    if (names.length < count) throw new Error(`No roster left for ${count} players`);
    const hostName = names[names.length - 1];
    await this.createRoom(hostName);
    for (const name of names.slice(0, -1)) await this.join(name);
    await this.setTimer(0);
  }

  /** Timer values the server accepts are only 0 | 60 | 90 | 120 (timer.ts). */
  async setTimer(seconds: number): Promise<void> {
    const label = seconds === 0 ? "∞" : `${seconds}s`;
    await board(this.hostPage).getByRole("button", { name: label, exact: true }).click();
    await expect(board(this.hostPage).getByRole("button", { name: label, exact: true }))
      .toHaveClass(/primary/);
  }

  // -------------------------------------------------------------------------
  // Playing
  // -------------------------------------------------------------------------

  async start(): Promise<void> {
    await board(this.hostPage).getByRole("button", { name: "Start game" }).click();
    await expect(board(this.hostPage).locator(".qcard")).toBeVisible({ timeout: ROUND_TIMEOUT });
  }

  async openNextRound(): Promise<void> {
    await board(this.hostPage).getByRole("button", { name: "Next round" }).click();
    await expect(board(this.hostPage).locator(".qcard")).toBeVisible({ timeout: ROUND_TIMEOUT });
  }

  async answer(name: string, text: string): Promise<void> {
    const page = this.pageFor(name);
    const input = board(page).locator('input[name="answer"]');
    await input.fill(text);
    await board(page).getByRole("button", { name: "Lock it in" }).click();
    await expect(board(page)).toContainText("Locked in");
  }

  async answerAll(answers: Record<string, string>): Promise<void> {
    for (const [name, text] of Object.entries(answers)) await this.answer(name, text);
  }

  /** Blocks until the host's board shows a resolved round. */
  /** Blocks until the host's board has left the asking phase — the round is
   *  settled (`.answer-row` in Results, `.winners` in GameOver) or the room is
   *  back in the lobby (`.big-code`). The lobby is included because the same
   *  assertions are used after a reset, where there is no round to settle.
   *
   *  NOT `.herd-banner`: the asking view reuses that class for its "Locked in"
   *  banner, and the host answers in most scenarios, so waiting on it returned
   *  while the round was still open. */
  async waitForResult(): Promise<void> {
    await board(this.hostPage).locator(".answer-row, .winners, .big-code").first().waitFor({
      timeout: ROUND_TIMEOUT,
    });
  }

  /** Clicks "Bad question" for `name`.
   *
   *  `expectChange` is false for a repeat rejection: the server ignores a
   *  player who already rejected, so the board legitimately does not move and
   *  waiting for a change would hang. */
  async reject(name: string, expectChange = true): Promise<void> {
    this.questionBeforeReject = await this.question();
    this.rejectsBefore = await this.rejectCount();
    const button = board(this.pageFor(name)).getByRole("button", { name: "Bad question" });
    await button.click();
    if (!expectChange) {
      // Let the request settle so assertions read a settled board. htmx holds
      // `htmx-request` on the element until its swap completes.
      await expect(button).not.toHaveClass(/htmx-request/);
      return;
    }
    // The click returns once the event is dispatched; htmx swaps the board
    // afterwards, and for a non-host it arrives over SSE up to a second later.
    // Either the tally moves or the question is replaced.
    await expect
      .poll(async () => `${await this.rejectCount()}|${await this.question()}`, {
        timeout: ROUND_TIMEOUT,
      })
      .not.toBe(`${this.rejectsBefore}|${this.questionBeforeReject}`);
  }

  /** "Play again" — back to an empty lobby with everyone still seated. */
  async playAgain(): Promise<void> {
    await board(this.hostPage).getByRole("button", { name: "Play again" }).click();
    await expect(board(this.hostPage).locator(".big-code")).toBeVisible({ timeout: ROUND_TIMEOUT });
  }

  /**
   * Plays whole rounds until somebody reaches `target` cows or `maxRounds` is
   * spent, recording each round. The cap is load-bearing: a strategy that keeps
   * someone on the pink cow never produces a winner, and the loop has to stop
   * so the scenario can assert the game is still running.
   */
  async playUntilCows(
    strategy: Strategy,
    target = WIN_COWS,
    maxRounds = 12,
  ): Promise<void> {
    for (let round = 1; round <= maxRounds; round++) {
      if (round === 1) await this.start();
      else await this.openNextRound();
      await this.answerAll(strategy(round, this.names()));
      await this.waitForResult();
      this.history.push(await this.readRound());
      if (Math.max(...Object.values(this.history.at(-1)!.cows)) >= target) return;
      if (await this.isGameOver()) return;
    }
  }

  // -------------------------------------------------------------------------
  // Reading the board
  // -------------------------------------------------------------------------

  /** Everything below reads the HOST's board: it carries the full scoreboard
   *  and every player's result row, so one page answers for the whole room. */

  async question(): Promise<string> {
    return (await board(this.hostPage).locator(".qcard").innerText()).trim();
  }

  async roundNumber(): Promise<number> {
    const head = await board(this.hostPage).locator(".round-head").innerText();
    return Number(/Round (\d+)/.exec(head)?.[1] ?? NaN);
  }

  /** The host board of a settled round carries one `.log-item` per resolved
   *  round, newest first, as `R1: question → herd`. */
  async resolvedRounds(): Promise<number[]> {
    const items = await board(this.hostPage).locator(".log-item").allInnerTexts();
    return items.map((t) => Number(/^R(\d+):/.exec(t.trim())?.[1] ?? NaN)).filter((n) => !isNaN(n));
  }

  async isGameOver(): Promise<boolean> {
    return await board(this.hostPage).locator(".winners").count() > 0;
  }

  /** Cows held by `name`, from the scoreboard's `🐮🐮 <b>N</b>/8`. */
  async cows(name: string): Promise<number> {
    const row = board(this.hostPage).locator(".score-row").filter({ hasText: name });
    return Number((await row.locator(".cows b").innerText()).trim());
  }

  async allCows(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const name of this.names()) out[name] = await this.cows(name);
    return out;
  }

  /** The scoreboard marks the pink-cow holder with 🐷 pink cow. Uses the CSS
   *  `:has()` combinator rather than `filter({ has })`, because an inner
   *  locator passed to `has` is resolved against the page, not the row. */
  async pinkHolder(): Promise<string | null> {
    const rows = board(this.hostPage).locator(".score-row:has(.pig)");
    if (await rows.count() === 0) return null;
    const text = await rows.first().innerText();
    return this.names().find((n) => text.includes(n)) ?? null;
  }

  /** Names badged `✅ herd` in the result rows. */
  async inHerd(): Promise<string[]> {
    const rows = board(this.hostPage).locator(".answer-row.herd .who");
    return (await rows.allInnerTexts()).map((t) => t.replace(":", "").trim());
  }

  /** The badge text on `name`'s result row, e.g. "✅ herd · +1 🐮". */
  async badge(name: string): Promise<string> {
    const row = board(this.hostPage).locator(".answer-row").filter({ hasText: `${name}:` });
    return (await row.locator(".badge").innerText()).trim();
  }

  async rejectCount(): Promise<string> {
    const text = await board(this.hostPage).innerText();
    return /\((\d+\/\d+) rejected\)/.exec(text)?.[1] ?? "";
  }

  /** Snapshots the settled board, for `win-and-reset`'s per-round assertions. */
  async readRound(): Promise<RoundRecord> {
    const [newest] = await this.resolvedRounds();
    return {
      round: newest,
      herd: (await board(this.hostPage).locator(".herd-banner .answer").count())
        ? (await board(this.hostPage).locator(".herd-banner .answer").innerText())
          .replace(/[“”]/g, "")
          .trim()
        : null,
      inHerd: await this.inHerd(),
      pinkHolder: await this.pinkHolder(),
      cows: await this.allCows(),
    };
  }

  private clearHistory(): void {
    this.history = [];
    this.lastRefused = null;
    this.questionBeforeReject = "";
  }

  /** Clears per-scenario state so one scenario can never see another's. */
  resetState(): void {
    this.clearHistory();
    this.seats.clear();
  }

  async close(): Promise<void> {
    await Promise.all(this.contexts.map((c) => c.close()));
    this.contexts.length = 0;
    this.seats.clear();
    this.clearHistory();
  }
}

/** Everything a player sees lives in the board, which htmx morphs in place. */
export function board(page: Page) {
  return page.locator("#board");
}

type Fixtures = { game: Game };

export const test = base.extend<Fixtures>({
  // Lazy in both directions: this body runs only when a step destructures
  // `game`, and `join()` opens a context only for the players a scenario uses.
  game: async ({ browser, page }, use, testInfo) => {
    const game = new Game(browser, page, {
      ignoreHTTPSErrors: testInfo.project.use.ignoreHTTPSErrors,
    });
    await use(game);
    await game.close();
  },
});
