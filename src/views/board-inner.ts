import type { Player, Room } from "../rooms.ts";
import type { HtmlNode } from "@http/html-stream/types";
import { asking } from "./asking.ts";
import { gameover } from "./gameover.ts";
import { judging } from "./judging.ts";
import { lobby } from "./lobby.ts";
import { results } from "./results.ts";

export function boardInner(room: Room, player: Player): HtmlNode {
  return room.phase === "lobby"
    ? lobby(room, player)
    : room.phase === "asking"
    ? asking(room, player)
    : room.phase === "judging"
    ? judging()
    : room.winners.length > 0
    ? gameover(room, player)
    : results(room, player);
}
