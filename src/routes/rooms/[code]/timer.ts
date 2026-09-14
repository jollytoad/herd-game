import { updateRoom } from "../../../rooms.ts";
import { boardReply, hostGuard, withSeat } from "./_helpers.ts";

export const POST = withSeat(async (_req, ctx) => {
  const denied = hostGuard(ctx, true);
  if (denied) return denied;
  const seconds = Number.parseInt(ctx.form.seconds ?? "");
  if ([0, 60, 90, 120].includes(seconds)) {
    await updateRoom(ctx.code, (r) => {
      if (r.phase === "lobby") r.timerSeconds = seconds;
    });
  }
  return boardReply(ctx.code, ctx.player);
});
