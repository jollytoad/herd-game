import { updateRoom } from "../../../rooms.ts";
import { boardReply, withSeat } from "./_helpers.ts";

export const POST = withSeat(async ({ code, player, form }) => {
  const answer = ((form.answer ?? "").trim() || "(no answer)").slice(0, 120);
  await updateRoom(code, (r) => {
    if (r.phase === "asking") r.answers[player.id] = answer;
  });
  // Do NOT await adjudication here — the SSE tick loop picks it up within 1s,
  // so the submitting player gets a snappy response.
  return boardReply(code, player);
});
