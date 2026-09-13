import { updateRoom } from "../../../rooms.ts";
import { boardReply, hostGuard, withSeat } from "./_helpers.ts";

export const POST = withSeat(async (ctx) => {
  const denied = hostGuard(ctx, true);
  if (denied) return denied;
  const playerId = (ctx.form.id ?? "").trim();
  await updateRoom(ctx.code, (r) => {
    if (r.phase !== "lobby" || playerId === r.hostId) return;
    r.players = r.players.filter((p) => p.id !== playerId);
  });
  return boardReply(ctx.code, ctx.player);
});
