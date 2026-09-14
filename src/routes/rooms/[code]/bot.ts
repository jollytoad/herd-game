import { addPlayer, BOT_NAMES, getRoom, PERSONALITIES } from "../../../rooms.ts";
import { boardReply, hostGuard, withSeat } from "./_helpers.ts";

function randomBotName(taken: string[]): string {
  const free = BOT_NAMES.filter((n) => !taken.some((t) => t.toLowerCase() === n.toLowerCase()));
  const pool = free.length > 0 ? free : BOT_NAMES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomPersonality(): string {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

export const POST = withSeat(async (_req, ctx) => {
  const denied = hostGuard(ctx, true);
  if (denied) return denied;
  const taken = (await getRoom(ctx.code))?.players.map((p) => p.name) ?? [];
  await addPlayer(ctx.code, randomBotName(taken), true, randomPersonality());
  return boardReply(ctx.code, ctx.player);
});
