import { cascade } from "@http/route/cascade";
import { byPattern } from "@http/route/by-pattern";
import { byMethod } from "@http/route/by-method";
import { renderHtmlResponse } from "@http/html-stream/render-html-response";
import { ok } from "@http/response/ok";

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
  removePlayer,
  resetGame,
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
import { seeOther } from "@http/response/see-other";
import { sessionCookie } from "./session.ts";
import { auth } from "./auth.ts";
import { sseHandler } from "./sse-handler.ts";
import { getBodyAsObject } from "@http/request/body-as-object";

/** Room codes are 4 uppercase letters/digits; actions are lowercase words. */
const ROOM = "/rooms/:code([A-Z0-9]{4})";

/** Handle the POST game actions (requires a seat at the table). */
async function roomAction(req: Request, match: URLPatternResult): Promise<Response> {
  const code = match.pathname.groups.code!;
  const action = match.pathname.groups.action!;

  const session = await auth(req, code);
  if (!session) return html(ErrorPage({ message: "You're not in that room." }), 403);
  const { room: initial, player } = session;

  const form = await getBodyAsObject<Record<string, string>>(req);

  switch (action) {
    case "start":
      await startGame(code);
      break;
    case "next":
      await nextRound(code);
      break;
    case "answer":
      await submitAnswer(code, player.id, form["answer"]);
      break;
    case "reject":
      await rejectQuestion(code, player.id);
      break;
    case "bot": {
      if (player.id === initial.hostId && initial.phase === "lobby") {
        const taken = (await getRoom(code))?.players.map((p) => p.name) ?? [];
        await addPlayer(code, randomBotName(taken), true, randomPersonality());
      }
      break;
    }
    case "remove": {
      if (player.id === initial.hostId && initial.phase === "lobby") {
        await removePlayer(code, form.id.trim());
      }
      break;
    }
    case "timer": {
      if (player.id === initial.hostId && initial.phase === "lobby") {
        const seconds = Number.parseInt(form.seconds);
        if ([0, 60, 90, 120].includes(seconds)) await setTimer(code, seconds);
      }
      break;
    }
    case "again": {
      if (player.id === initial.hostId) await resetGame(code);
      break;
    }
    default:
      return html(ErrorPage({ message: "Unknown action." }), 404);
  }

  const fresh = await getRoom(code);
  if (!fresh) return html(ErrorPage({ message: "This room has vanished." }), 404);
  const me = fresh.players.find((p) => p.id === player.id) ?? player;
  return html(Board({ room: fresh, player: me }));
}

export default cascade(
  byPattern(
    "/",
    byMethod({
      GET: () => renderHtmlResponse(LandingPage()),
    }),
  ),
  byPattern(
    "/style.css",
    byMethod({
      GET: async () => {
        const css = (await import("../style.css", { with: { type: "text" } })).default;
        return ok(css, {
          "content-type": "text/css; charset=utf-8",
          "cache-control": "no-cache",
        });
      },
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
  // TODO: wrap in an interceptor that check the player is in the room
  byPattern(
    `${ROOM}/:action([a-z]+)`,
    byMethod({
      // TODO: split actions into separate routes
      POST: roomAction,
    }),
  ),
);
