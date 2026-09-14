import { drawQuestion } from "../../../game.ts";
import { getRoom, updateRoom } from "../../../rooms.ts";
import { boardReply, withSeat } from "./_helpers.ts";

export const POST = withSeat(async (_req, { code, player }) => {
  const room = await getRoom(code);
  // only meaningful while a question is on the table, and once per player
  if (room?.phase === "asking" && !room.rejects.includes(player.id)) {
    const rejects = [...room.rejects, player.id];
    const threshold = Math.ceil(room.players.length / 2);
    if (rejects.length >= threshold) {
      // Guard against double-flips when two players reject simultaneously.
      const fresh = await getRoom(code);
      if (fresh?.phase === "asking" && fresh.question === room.question) {
        await drawQuestion(code);
      }
    } else {
      await updateRoom(code, (r) => {
        if (r.phase === "asking" && !r.rejects.includes(player.id)) r.rejects.push(player.id);
      });
    }
  }
  return boardReply(code, player);
});
