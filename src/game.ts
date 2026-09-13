/** Game flow: phase machine, lazy timers, bot scheduling, adjudication.
 *  All mutations go through rooms.ts's atomic updateRoom. Timers and bot
 *  answer reveals are driven lazily by tickRoom() (called from every SSE loop
 *  and action request) rather than setTimeout, so it works on elastic isolates.
 *
 *  Latency design: the question flip itself never waits on the LLM. Bot
 *  answers are generated in one background LLM call right after the flip and
 *  revealed 1–5s in; until prepared, bots simply haven't answered yet. Deck
 *  top-ups also run in the background unless the deck is truly empty. */

import {
  BOT_NAMES,
  getRoom,
  MAX_PLAYERS,
  PERSONALITIES,
  type Player,
  type Room,
  updateRoom,
  WIN_COWS,
} from "./rooms.ts";
import { botAnswers, generateQuestions, judgeRound } from "./judge.ts";

const DECK_TOPUP = 12;

/** Register background work with the runtime where possible (Deno Deploy
 *  terminates detached promises after the response otherwise). No-op locally. */
function background(p: Promise<unknown>): void {
  const edge = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } })
    .EdgeRuntime;
  edge?.waitUntil?.(p);
}

/** Bots reveal their prepared answer 1–5s after the question flips. */
function scheduleBots(
  room: {
    players: Player[];
    deadline: number | null;
    botDue: Record<string, number>;
  },
) {
  room.botDue = {};
  for (const p of room.players) {
    if (!p.bot) continue;
    let dueAt = Date.now() + (1 + Math.random() * 4) * 1000;
    // never reveal after the deadline (leave 2s of slack)
    if (room.deadline) dueAt = Math.min(dueAt, room.deadline - 2_000);
    room.botDue[p.id] = dueAt;
  }
}

// ---------------------------------------------------------------------------
// Deck management
// ---------------------------------------------------------------------------

/** Fire-and-forget deck top-up; never blocks a flip. */
function topUpDeckBackground(code: string): void {
  background(
    (async () => {
      const room = await getRoom(code);
      if (!room || room.deck.length >= 3) return;
      const questions = await generateQuestions(DECK_TOPUP);
      await updateRoom(code, (r) => {
        r.deck.push(...questions);
      });
    })().catch((err) => console.error("background deck top-up failed:", err)),
  );
}

/** Generate and store bot answers for the current question in one LLM call. */
async function precomputeBotAnswers(code: string, room: Room): Promise<void> {
  const question = room.question ?? "";
  const bots = room.players.filter((p) => p.bot);
  if (bots.length === 0) return;
  const answers = await botAnswers(
    question,
    bots.map((p) => ({ id: p.id, personality: p.personality })),
  );
  // Guard against racing a reject-flip: only apply if the round didn't change.
  await updateRoom(code, (r) => {
    if (r.phase === "asking" && r.round === room.round && r.question === question) {
      r.botPrepared = answers;
    }
  });
}

/** Flip to the next question (lobby -> asking, or results/reject -> asking).
 *  Returns after the flip; LLM work (deck top-up, bot answers) runs in the
 *  background. */
export async function drawQuestion(code: string): Promise<Room | null> {
  // First flip ever may have an empty deck: we need a question now, so
  // this one LLM call blocks. Later flips only background-top-up.
  let room = await getRoom(code);
  if (room && room.deck.length === 0) {
    const questions = await generateQuestions(DECK_TOPUP);
    await updateRoom(code, (r) => {
      r.deck.push(...questions);
    });
  } else if (room && room.deck.length < 3) {
    topUpDeckBackground(code);
  }

  room = await updateRoom(code, (r) => {
    r.round += 1;
    r.question = r.deck.shift() ?? "Name something everyone in this room has in common.";
    r.phase = "asking";
    r.answers = {};
    r.rejects = [];
    r.lastResult = null;
    r.winners = [];
    r.judgingToken = null;
    r.deadline = r.timerSeconds > 0 ? Date.now() + r.timerSeconds * 1000 : null;
    scheduleBots(r);
  });
  if (!room) return room;

  // Precompute bot answers off the critical path; tickRoom reveals them
  // once prepared (1–5s in, LLM latency permitting).
  background(
    precomputeBotAnswers(code, room).catch((err) =>
      console.error("background bot answer generation failed:", err)
    ),
  );
  return await getRoom(code);
}

// ---------------------------------------------------------------------------
// Round end + adjudication
// ---------------------------------------------------------------------------

/** If everyone answered or the timer expired, claim the round and judge it.
 *  Safe to call concurrently: only the claimer runs the LLM. */
export async function maybeEndRound(code: string): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.phase !== "asking") return;
  const allAnswered = room.players.length > 0 &&
    room.players.every((p) => room.answers[p.id] !== undefined);
  const expired = room.deadline !== null && Date.now() >= room.deadline;
  if (!allAnswered && !expired) return;

  const token = crypto.randomUUID();
  const updated = await updateRoom(code, (r) => {
    if (r.phase !== "asking") return;
    const all = r.players.length > 0 && r.players.every((p) => r.answers[p.id] !== undefined);
    const exp = r.deadline !== null && Date.now() >= r.deadline;
    if (!all && !exp) return;
    r.phase = "judging";
    r.judgingToken = token;
    for (const p of r.players) {
      if (r.answers[p.id] === undefined) r.answers[p.id] = "(no answer)";
    }
  });
  if (updated?.judgingToken === token) {
    await adjudicate(code);
  }
}

/** Run the LLM judge and apply the verdict. Only called by the claimer. */
export async function adjudicate(code: string): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.phase !== "judging" || !room.question) return;

  const verdict = await judgeRound(room);

  await updateRoom(code, (r) => {
    if (r.phase !== "judging") return;
    const matched = new Set(verdict.matched_players);
    for (const p of r.players) {
      if (matched.has(p.id)) {
        p.cows += 1;
        p.pinkCow = false; // matching the herd sheds the pink cow
      }
    }
    // Only ONE pink cow exists: it goes to a player solely when they are
    // the ONLY player not in the herd. Existing holders otherwise keep it.
    const missed = r.players.filter((p) => !matched.has(p.id));
    if (verdict.herd_answer !== null && missed.length === 1) {
      missed[0].pinkCow = true;
    }
    r.lastResult = {
      herd: verdict.herd_answer,
      commentary: verdict.commentary,
      answers: r.players.map((p) => ({
        name: p.name,
        answer: r.answers[p.id] ?? "(no answer)",
        inHerd: matched.has(p.id),
        holdsPinkCow: p.pinkCow,
      })),
    };
    r.log.unshift({ round: r.round, question: r.question ?? "", herd: verdict.herd_answer });
    r.log = r.log.slice(0, 20);
    r.winners = r.players.filter((p) => p.cows >= WIN_COWS && !p.pinkCow).map((p) => p.id);
    r.phase = r.winners.length > 0 ? "gameover" : "results";
    r.question = null;
    r.answers = {};
    r.rejects = [];
    r.deadline = null;
    r.botDue = {};
    r.botPrepared = {};
    r.judgingToken = null;
  });
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

export async function submitAnswer(code: string, playerId: string, text: string): Promise<void> {
  const answer = (text.trim() || "(no answer)").slice(0, 120);
  await updateRoom(code, (r) => {
    if (r.phase === "asking") r.answers[playerId] = answer;
  });
  // Do NOT await adjudication here — the SSE tick loop picks it up within 1s,
  // so the submitting player gets a snappy response.
}

export async function rejectQuestion(code: string, playerId: string): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.phase !== "asking") return;
  if (room.rejects.includes(playerId)) return;

  const rejects = [...room.rejects, playerId];
  const threshold = Math.ceil(room.players.length / 2);
  if (rejects.length >= threshold) {
    // Guard against double-flips when two players reject simultaneously.
    const fresh = await getRoom(code);
    if (fresh && fresh.phase === "asking" && fresh.question === room.question) {
      await drawQuestion(code);
    }
    return;
  }
  await updateRoom(code, (r) => {
    if (r.phase === "asking" && !r.rejects.includes(playerId)) r.rejects.push(playerId);
  });
}

export async function startGame(code: string): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.phase !== "lobby" || room.players.length < 3) return;
  await drawQuestion(code);
}

export async function nextRound(code: string): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.phase !== "results") return;
  await drawQuestion(code);
}

// ---------------------------------------------------------------------------
// Lazy tick: bot reveals + round-end detection (drives everything on a 1s SSE loop)
// ---------------------------------------------------------------------------

export async function tickRoom(code: string): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.phase !== "asking") return;

  const now = Date.now();
  const due = room.players.filter((p) =>
    p.bot && room.answers[p.id] === undefined && (room.botDue[p.id] ?? Infinity) <= now
  );

  if (due.length > 0) {
    // Reveal only bots whose prepared answer has arrived; leave the rest due
    // so a slow LLM response delays the reveal instead of producing junk.
    await updateRoom(code, (r) => {
      if (r.phase !== "asking") return;
      for (const b of due) {
        if (r.answers[b.id] !== undefined || r.botDue[b.id] === undefined) continue;
        const prepared = r.botPrepared[b.id];
        if (prepared !== undefined) {
          r.answers[b.id] = prepared;
          delete r.botDue[b.id];
        }
      }
    });
  }

  await maybeEndRound(code);
}

// ---------------------------------------------------------------------------
// Misc helpers used by routes
// ---------------------------------------------------------------------------

export function randomBotName(taken: string[]): string {
  const free = BOT_NAMES.filter((n) => !taken.some((t) => t.toLowerCase() === n.toLowerCase()));
  const pool = free.length > 0 ? free : BOT_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function randomPersonality(): string {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

export function canStart(room: { phase: string; players: unknown[] }): boolean {
  return room.phase === "lobby" && room.players.length >= 3 && room.players.length <= MAX_PLAYERS;
}
