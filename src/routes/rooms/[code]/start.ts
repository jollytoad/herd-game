import { drawQuestion } from "../../../game.ts";
import { getRoom } from "../../../rooms.ts";
import { boardReply, withSeat } from "./_helpers.ts";

export const POST = withSeat(async ({ code, player }) => {
  const room = await getRoom(code);
  if (room?.phase === "lobby" && room.players.length >= 3) await drawQuestion(code);
  return boardReply(code, player);
});
