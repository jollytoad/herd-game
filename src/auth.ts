import { getCookies } from "@std/http/cookie";
import { getRoom, type Player, type Room, touchPlayer } from "./rooms.ts";
import { html } from "./html.ts";
import { ErrorPage } from "./views/error-page.tsx";

/** Thrown when a request isn't from a seated player — catchResponse (main.ts)
 *  turns a thrown Response into the response of the request. */
export function notSeated(): never {
  throw html(ErrorPage({ message: "You're not in that room." }), 403);
}

/** Resolve the current player from the room-scoped cookie.
 *  Throws a 403 Response when the room doesn't exist or the requester isn't
 *  seated (see notSeated). */
export async function auth(
  req: Request,
  code: string,
): Promise<{ room: Room; player: Player }> {
  const room = await getRoom(code);
  if (!room) notSeated();
  const { token } = getCookies(req.headers);
  const player = token ? room.players.find((p) => p.token === token) : undefined;
  if (!player) notSeated();
  touchPlayer(code, player.id).catch(() => {});
  return { room, player };
}
