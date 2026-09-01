import type { Player, Room } from "../rooms.ts";
import { Asking } from "./asking.tsx";
import { GameOver } from "./gameover.tsx";
import { Judging } from "./judging.tsx";
import { Lobby } from "./lobby.tsx";
import { Results } from "./results.tsx";

export function BoardInner(props: { room: Room; player: Player }) {
  const { room, player } = props;
  return room.phase === "lobby"
    ? <Lobby room={room} player={player} />
    : room.phase === "asking"
    ? <Asking room={room} player={player} />
    : room.phase === "judging"
    ? <Judging />
    : room.winners.length > 0
    ? <GameOver room={room} player={player} />
    : <Results room={room} player={player} />;
}
