/** Game flow: phase machine, lazy timers, bot scheduling, adjudication.
 *  All mutations go through rooms.ts's atomic updateRoom. Timers and bot
 *  turns are driven lazily by tickRoom() (called from every SSE loop and
 *  action request) rather than setTimeout, so it works on elastic isolates. */

import { trace } from "@opentelemetry/api";
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

// ---------------------------------------------------------------------------
// Deck management
// ---------------------------------------------------------------------------

async function ensureDeck(code: string): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.deck.length >= 3) return;
  const questions = await generateQuestions(DECK_TOPUP);
  await updateRoom(code, (r) => {
    r.deck.push(...questions);
  });
}

function scheduleBots(
  room: {
    players: Player[];
    deadline: number | null;
    botDue: Record<string, number>;
    botPending: Record<string, boolean>;
  },
) {
  room.botDue = {};
  room.botPending = {};
  const slack = room.deadline ? room.deadline - Date.now() - 3000 : 20_000;
  const window = Math.max(slack, 2_000);
  for (const p of room.players) {
    if (p.bot) {
      room.botDue[p.id] = Date.now() + 4_000 + Math.floor(Math.random() * window);
    }
  }
}

/** Flip to the next question (lobby -> asking, or results/reject -> asking). */
export function drawQuestion(code: string): Promise<Room | null> {
  const tracer = trace.getTracer("herd-intelligence.game");
  return tracer.startActiveSpan(
    "game.draw_question",
    { attributes: { "room.code": code } },
    async (span) => {
      try {
        await ensureDeck(code);
        const room = await updateRoom(code, (r) => {
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
        if (room) {
          span.setAttributes({ "game.round": room.round, "game.deck_left": room.deck.length });
        }
        return room;
      } finally {
        span.end();
      }
    },
  );
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
  const tracer = trace.getTracer("herd-intelligence.game");
  await tracer.startActiveSpan(
    "game.adjudicate",
    { attributes: { "room.code": code } },
    async (span) => {
      try {
        const room = await getRoom(code);
        if (!room || room.phase !== "judging" || !room.question) {
          span.setAttribute("game.skipped", true);
          return;
        }
        span.setAttribute("game.round", room.round);

        const verdict = await judgeRound(room);
        span.setAttribute("judge.herd_found", verdict.herd_answer !== null);

        let winnerCount = 0;
        await updateRoom(code, (r) => {
          if (r.phase !== "judging") return;
          const matched = new Set(verdict.matched_players);
          r.lastResult = {
            herd: verdict.herd_answer,
            commentary: verdict.commentary,
            answers: r.players.map((p) => ({
              name: p.name,
              answer: r.answers[p.id] ?? "(no answer)",
              inHerd: matched.has(p.id),
            })),
          };
          for (const p of r.players) {
            if (matched.has(p.id)) {
              p.cows += 1;
              p.pinkCow = false; // matching the herd sheds the pink cow
            } else if (verdict.herd_answer !== null) {
              p.pinkCow = true; // missed the herd on ANY question -> pink cow
            }
          }
          r.log.unshift({ round: r.round, question: r.question ?? "", herd: verdict.herd_answer });
          r.log = r.log.slice(0, 20);
          r.winners = r.players.filter((p) => p.cows >= WIN_COWS && !p.pinkCow).map((p) => p.id);
          r.phase = r.winners.length > 0 ? "gameover" : "results";
          r.question = null;
          r.answers = {};
          r.rejects = [];
          r.deadline = null;
          r.botDue = {};
          r.botPending = {};
          r.judgingToken = null;
          winnerCount = r.winners.length;
        });
        span.setAttribute("game.winners", winnerCount);
      } finally {
        span.end();
      }
    },
  );
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
// Lazy tick: bot turns + round-end detection (drives everything on a 1s SSE loop)
// ---------------------------------------------------------------------------

export async function tickRoom(code: string): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.phase !== "asking") return;

  const now = Date.now();
  const due = room.players.filter((p) =>
    p.bot && room.answers[p.id] === undefined &&
    !room.botPending[p.id] && (room.botDue[p.id] ?? Infinity) <= now
  );

  if (due.length > 0) {
    const claimed = await updateRoom(code, (r) => {
      if (r.phase !== "asking") return;
      for (const b of due) {
        if (r.answers[b.id] === undefined && !r.botPending[b.id] && r.botDue[b.id] !== undefined) {
          r.botPending[b.id] = true;
        }
      }
    });
    // Only the claimer (version moved) generates; others will see answers soon.
    if (claimed && claimed.players.some((p) => p.bot && claimed.botPending[p.id])) {
      const pending = claimed.players.filter((p) => p.bot && claimed.botPending[p.id]);
      const answers = await botAnswers(
        claimed.question ?? "",
        pending.map((p) => ({ id: p.id, personality: p.personality })),
      );
      await updateRoom(code, (r) => {
        if (r.phase !== "asking") return;
        for (const b of pending) {
          delete r.botPending[b.id];
          if (r.answers[b.id] === undefined && answers[b.id]) r.answers[b.id] = answers[b.id];
        }
      });
    }
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
