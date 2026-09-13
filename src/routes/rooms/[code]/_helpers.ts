import { getBodyAsObject } from "@http/request/body-as-object";

import { getRoom, type Player, type Room } from "../../../rooms.ts";
import { auth } from "../../../auth.ts";
import { html } from "../../../html.ts";
import { Board } from "../../../views/board-html.tsx";
import { ErrorPage } from "../../../views/error-page.tsx";

export function notSeated(): Response {
  return html(ErrorPage({ message: "You're not in that room." }), 403);
}

export function notHost(): Response {
  return html(ErrorPage({ message: "Only the host can do that." }), 403);
}

/** Standard action reply: re-read the room and render the caller's board. */
export async function boardReply(code: string, player: Player): Promise<Response> {
  const fresh = await getRoom(code);
  if (!fresh) return html(ErrorPage({ message: "This room has vanished." }), 404);
  const me = fresh.players.find((p) => p.id === player.id) ?? player;
  return html(Board({ room: fresh, player: me }));
}

export type ActionCtx = {
  code: string;
  room: Room; // snapshot at request time
  player: Player;
  form: Record<string, string>;
};

/** Seat-auth interceptor for game actions: resolves the room + player from
 *  the room-scoped cookie and parses the form body before calling through. */
export function withSeat(
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
export function hostGuard(ctx: ActionCtx, lobbyOnly = false): Response | null {
  if (ctx.player.id !== ctx.room.hostId) return notHost();
  if (lobbyOnly && ctx.room.phase !== "lobby") return notHost();
  return null;
}
