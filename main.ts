/** Herd Intelligence — server. Plain Deno.serve, no framework.
 *
 *  Actions: htmx POST -> re-rendered #board fragment.
 *  State updates: SSE "board" events -> tiny EventSource listener on the page.
 *  Timers/bots run lazily via tickRoom() on the SSE loop (Deploy-safe).
 */

import styleCss from "./style.css" with { type: "text" };
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
  touchPlayer,
} from "./src/rooms.ts";
import {
  nextRound,
  randomBotName,
  randomPersonality,
  rejectQuestion,
  startGame,
  submitAnswer,
  tickRoom,
} from "./src/game.ts";
import type { HtmlNode } from "@http/html-stream/types";
import { renderString } from "@http/token-stream/render-string";
import { renderHtmlBody } from "@http/html-stream/render-html-body";
import { Board } from "./src/views/board-html.tsx";
import { JoinPage } from "./src/views/join-page.tsx";
import { RoomPage } from "./src/views/room-page.tsx";
import { LandingPage } from "./src/views/landing-page.tsx";
import { ErrorPage } from "./src/views/error-page.tsx";

const PORT = Number(Deno.env.get("PORT") ?? 8000);

// ---------------------------------------------------------------------------
// Http helpers
// ---------------------------------------------------------------------------

function html(body: HtmlNode, status = 200): Response {
  return new Response(renderHtmlBody(body), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function redirect(location: string, cookie?: string): Response {
  const headers = new Headers({ location });
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sessionCookie(code: string, token: string): string {
  return `token=${
    encodeURIComponent(token)
  }; Path=/rooms/${code}; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

async function formField(req: Request, name: string): Promise<string> {
  try {
    const form = await req.formData();
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  } catch {
    return "";
  }
}

function cssResponse(): Response {
  return new Response(styleCss, {
    headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-cache" },
  });
}

// ---------------------------------------------------------------------------
// Auth helper: resolve the current player from the room-scoped cookie
// ---------------------------------------------------------------------------

async function auth(
  req: Request,
  code: string,
): Promise<{ room: Room; player: Player } | null> {
  const room = await getRoom(code);
  if (!room) return null;
  const token = getCookie(req, "token");
  const player = token ? room.players.find((p) => p.token === token) : undefined;
  if (!player) return null;
  touchPlayer(code, player.id).catch(() => {});
  return { room, player };
}

// ---------------------------------------------------------------------------
// SSE: streams a fresh #board fragment whenever the room version changes
// (every 1s during the asking phase, so the countdown stays live)
// ---------------------------------------------------------------------------

function sseHandler(req: Request, code: string): Response {
  const token = getCookie(req, "token");
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastVersion = -1;
      const send = async (html: HtmlNode) => {
        // Unnamed events auto-swap via the hx-sse extension's hx-target/hx-swap.
        controller.enqueue(
          encoder.encode(`data: ${(await renderString(html)).replace(/\s*\n\s*/g, " ")}\n\n`),
        );
      };
      try {
        // Loop until the room dies or the client disconnects (a disconnect makes
        // the next enqueue() throw). We deliberately do not use req.signal:
        // Deno's legacy behavior aborts it as soon as the streaming Response is
        // returned, which would kill the stream immediately.
        while (true) {
          await tickRoom(code); // lazy timers + bot turns
          const room = await getRoom(code);
          if (!room) break;
          const player = token ? room.players.find((p) => p.token === token) : undefined;
          if (!player) break; // not a member of this room
          if (room.version !== lastVersion || room.phase === "asking") {
            await send(Board({ room, player }));
            lastVersion = room.version;
          } else {
            controller.enqueue(encoder.encode(": ping\n\n"));
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch {
        // client disconnected or stream errored; EventSource reconnects
      }
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

Deno.serve({ port: PORT }, async (req: Request): Promise<Response> => {
  const { pathname } = new URL(req.url);
  try {
    if (req.method === "GET" && pathname === "/") return html(LandingPage());
    if (req.method === "GET" && pathname === "/style.css") return cssResponse();

    // --- create / join (plain form posts with redirects) ---
    if (req.method === "POST" && pathname === "/rooms") {
      const name = (await formField(req, "name")).trim().slice(0, 24) || "Player";
      const { code, token } = await createRoom(name);
      return redirect(`/rooms/${code}`, sessionCookie(code, token));
    }
    if (req.method === "POST" && pathname === "/rooms/join") {
      const code = normCode(await formField(req, "code"));
      const name = (await formField(req, "name")).trim().slice(0, 24) || "Player";
      if (!code) {
        return html(JoinPage({ code: "----", error: "That code doesn't look right." }), 400);
      }
      const result = await addPlayer(code, name, false);
      if ("error" in result) return html(JoinPage({ code, error: result.error }), 400);
      return redirect(`/rooms/${code}`, sessionCookie(code, result.token));
    }

    // --- room routes ---
    const roomMatch = pathname.match(/^\/rooms\/([A-Z0-9]{4})(\/[a-z]+)?$/);
    if (roomMatch) {
      const code = roomMatch[1];
      const action = roomMatch[2]?.slice(1) ?? "";

      if (req.method === "GET" && action === "") {
        const session = await auth(req, code);
        if (!session) return html(JoinPage({ code }));
        return html(RoomPage({ room: session.room, player: session.player }));
      }
      if (req.method === "GET" && action === "events") {
        return sseHandler(req, code);
      }
      if (req.method === "POST" && action === "join") {
        const name = (await formField(req, "name")).trim().slice(0, 24) || "Player";
        const result = await addPlayer(code, name, false);
        if ("error" in result) return html(JoinPage({ code, error: result.error }), 400);
        return redirect(`/rooms/${code}`, sessionCookie(code, result.token));
      }

      // everything below requires a seat at the table
      const session = await auth(req, code);
      if (!session) return html(ErrorPage({ message: "You're not in that room." }), 403);
      const { room: initial, player } = session;

      switch (req.method === "POST" ? action : "") {
        case "start":
          await startGame(code);
          break;
        case "next":
          await nextRound(code);
          break;
        case "answer":
          await submitAnswer(code, player.id, await formField(req, "answer"));
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
            await removePlayer(code, (await formField(req, "id")).trim());
          }
          break;
        }
        case "timer": {
          if (player.id === initial.hostId && initial.phase === "lobby") {
            const seconds = Number(await formField(req, "seconds"));
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

    return html(ErrorPage({ message: "404 — nothing here but hay." }), 404);
  } catch (err) {
    console.error("unhandled:", err);
    return html(ErrorPage(), 500);
  }
});
