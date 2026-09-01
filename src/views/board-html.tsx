import type { Player, Room } from "../rooms.ts";
import { BoardInner } from "./board-inner.tsx";

export function Board(props: { room: Room; player: Player }) {
  return (
    <div id="board">
      <BoardInner room={props.room} player={props.player} />
    </div>
  );
}
