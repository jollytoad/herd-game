import { getCookies } from "@std/http/cookie";
import { getRoom, type Player, type Room, touchPlayer } from "./rooms.ts";

// ---------------------------------------------------------------------------
// Auth helper: resolve the current player from the room-scoped cookie
// ---------------------------------------------------------------------------
export async function auth(
  req: Request,
  code: string,
): Promise<{ room: Room; player: Player } | null> {
  const room = await getRoom(code);
  if (!room) return null;
  const { token } = getCookies(req.headers);
  const player = token ? room.players.find((p) => p.token === token) : undefined;
  if (!player) return null;
  touchPlayer(code, player.id).catch(() => {});
  return { room, player };
}
