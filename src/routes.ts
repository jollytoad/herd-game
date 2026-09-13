import { cascade } from "@http/route/cascade";
import { byPattern } from "@http/route/by-pattern";
import { byMethod } from "@http/route/by-method";
import { renderHtmlResponse } from "@http/html-stream/render-html-response";
import { interceptResponse } from "@http/interceptor/intercept-response";
import { skip } from "@http/interceptor/skip";
import { staticRoute } from "@http/route/static-route";
import { getBodyAsObject } from "@http/request/body-as-object";
import { seeOther } from "@http/response/see-other";

import { LandingPage } from "./views/landing-page.tsx";
import { JoinPage } from "./views/join-page.tsx";
import { RoomPage } from "./views/room-page.tsx";
import { Board } from "./views/board-html.tsx";
import { ErrorPage } from "./views/error-page.tsx";

import {
  addPlayer,
  createRoom,
  getRoom,
  normCode,
  type Player,
  removePlayer,
  resetGame,
  type Room,
  setTimer,
} from "./rooms.ts";
import {
  nextRound,
  randomBotName,
  randomPersonality,
  rejectQuestion,
  startGame,
  submitAnswer,
} from "./game.ts";
import { html } from "./html.ts";
import { sessionCookie } from "./session.ts";
import { auth } from "./auth.ts";
import { sseHandler } from "./sse-handler.ts";

/** Room codes are 4 uppercase letters/digits; actions are lowercase words. */
const ROOM = "/rooms/:code([A-Z0-9]{4})";

// ---------------------------------------------------------------------------
// Game-action helpers
// ---------------------------------------------------------------------------

function notSeated(): Response {
  return html(ErrorPage({ message: "You're not in that room." }), 403);
}

function notHost(): Response {
  return html(ErrorPage({ message: "Only the host can do that." }), 403);
}

/** Standard action reply: re-read the room and render the caller's board. */
async function boardReply(code: string, player: Player): Promise<Response> {
  const fresh = await getRoom(code);
  if (!fresh) return html(ErrorPage({ message: "This room has vanished." }), 404);
  const me = fresh.players.find((p) => p.id === player.id) ?? player;
  return html(Board({ room: fresh, player: me }));
}

type ActionCtx = {
  code: string;
  room: Room; // snapshot at request time
  player: Player;
  form: Record<string, string>;
};

/** Seat-auth interceptor for game actions: resolves the room + player from
 *  the room-scoped cookie and parses the form body before calling through. */
function withSeat(
  handle: (ctx: ActionCtx) => Promise<Response>,
): (req: Request, match: URLPatternResult) => Promise<Response> {
  return async (req, match) => {
    const code = match.pathname.groups.code!;
    const session = await auth(req, code);
    if (!session) return notSeated();
    const form = await getBodyAsObject<Record<string, string>>(req);
    return handle({ code, room: session.room, player: session.player, form });
  };
}

/** 403 unless the caller is the host (and, with `lobbyOnly`, still in the lobby). */
function hostGuard(ctx: ActionCtx, lobbyOnly = false): Response | null {
  if (ctx.player.id !== ctx.room.hostId) return notHost();
  if (lobbyOnly && ctx.room.phase !== "lobby") return notHost();
  return null;
}

// ---------------------------------------------------------------------------
// The game actions (one handler per route)
// ---------------------------------------------------------------------------

const startAction = withSeat(async ({ code, player }) => {
  await startGame(code);
  return boardReply(code, player);
});

const answerAction = withSeat(async ({ code, player, form }) => {
  await submitAnswer(code, player.id, form.answer ?? "");
  return boardReply(code, player);
});

const rejectAction = withSeat(async ({ code, player }) => {
  await rejectQuestion(code, player.id);
  return boardReply(code, player);
});

const nextAction = withSeat(async ({ code, player }) => {
  await nextRound(code);
  return boardReply(code, player);
});

const botAction = withSeat(async (ctx) => {
  const denied = hostGuard(ctx, true);
  if (denied) return denied;
  const taken = (await getRoom(ctx.code))?.players.map((p) => p.name) ?? [];
  await addPlayer(ctx.code, randomBotName(taken), true, randomPersonality());
  return boardReply(ctx.code, ctx.player);
});

const removeAction = withSeat(async (ctx) => {
  const denied = hostGuard(ctx, true);
  if (denied) return denied;
  await removePlayer(ctx.code, (ctx.form.id ?? "").trim());
  return boardReply(ctx.code, ctx.player);
});

const timerAction = withSeat(async (ctx) => {
  const denied = hostGuard(ctx, true);
  if (denied) return denied;
  const seconds = Number.parseInt(ctx.form.seconds ?? "");
  if ([0, 60, 90, 120].includes(seconds)) await setTimer(ctx.code, seconds);
  return boardReply(ctx.code, ctx.player);
});

const againAction = withSeat(async (ctx) => {
  const denied = hostGuard(ctx);
  if (denied) return denied;
  await resetGame(ctx.code);
  return boardReply(ctx.code, ctx.player);
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default cascade(
  byPattern(
    "/",
    byMethod({
      GET: () => renderHtmlResponse(LandingPage()),
    }),
  ),
  // --- create / join (plain form posts with redirects) ---
  byPattern(
    "/rooms",
    byMethod({
      POST: async (req) => {
        const form = await getBodyAsObject<Record<string, string>>(req);
        const name = form.name?.trim().slice(0, 24) || "Player";
        const { code, token } = await createRoom(name);
        return seeOther(`/rooms/${code}`, sessionCookie(code, token));
      },
    }),
  ),
  byPattern(
    "/rooms/join",
    byMethod({
      POST: async (req) => {
        const form = await getBodyAsObject<Record<string, string>>(req);
        const code = normCode(form.code ?? "");
        const name = form.name?.trim().slice(0, 24) || "Player";
        if (!code) {
          return html(JoinPage({ code: "----", error: "That code doesn't look right." }), 400);
        }
        const result = await addPlayer(code, name, false);
        if ("error" in result) return html(JoinPage({ code, error: result.error }), 400);
        return seeOther(`/rooms/${code}`, sessionCookie(code, result.token));
      },
    }),
  ),
  // --- room routes ---
  byPattern(
    ROOM,
    byMethod({
      GET: async (req, match) => {
        const code = match.pathname.groups.code!;
        const session = await auth(req, code);
        if (!session) return html(JoinPage({ code }));
        return html(RoomPage({ room: session.room, player: session.player }));
      },
    }),
  ),
  byPattern(
    `${ROOM}/events`,
    byMethod({
      GET: (req, match) => sseHandler(req, match.pathname.groups.code!),
    }),
  ),
  byPattern(
    `${ROOM}/join`,
    byMethod({
      POST: async (req, match) => {
        const code = match.pathname.groups.code!;
        const form = await getBodyAsObject<Record<string, string>>(req);
        const name = form.name?.trim().slice(0, 24) || "Player";
        const result = await addPlayer(code, name, false);
        if ("error" in result) return html(JoinPage({ code, error: result.error }), 400);
        return seeOther(`/rooms/${code}`, sessionCookie(code, result.token));
      },
    }),
  ),
  // --- game actions (one route per action; withSeat does the seat auth) ---
  byPattern(`${ROOM}/start`, byMethod({ POST: startAction })),
  byPattern(`${ROOM}/answer`, byMethod({ POST: answerAction })),
  byPattern(`${ROOM}/reject`, byMethod({ POST: rejectAction })),
  byPattern(`${ROOM}/next`, byMethod({ POST: nextAction })),
  byPattern(`${ROOM}/bot`, byMethod({ POST: botAction })),
  byPattern(`${ROOM}/remove`, byMethod({ POST: removeAction })),
  byPattern(`${ROOM}/timer`, byMethod({ POST: timerAction })),
  byPattern(`${ROOM}/again`, byMethod({ POST: againAction })),
  interceptResponse(staticRoute("/", import.meta.resolve("../public")), skip(405)),
);
