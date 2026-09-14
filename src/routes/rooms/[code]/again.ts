import { updateRoom } from "../../../rooms.ts";
import { boardReply, hostGuard, withSeat } from "./_helpers.ts";

export const POST = withSeat(async (_req, ctx) => {
  hostGuard(ctx); // 403 unless host
  await updateRoom(ctx.code, (r) => {
    r.phase = "lobby";
    r.round = 0;
    r.winners = [];
    r.lastResult = null;
    r.question = null;
    r.answers = {};
    r.rejects = [];
    r.deadline = null;
    r.botDue = {};
    r.botPrepared = {};
    r.judgingToken = null;
    for (const p of r.players) {
      p.cows = 0;
      p.pinkCow = false;
    }
  });
  return boardReply(ctx.code, ctx.player);
});
