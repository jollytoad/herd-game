import { GAME_NAME } from "../brand.ts";
import type { Player, Room } from "../rooms.ts";
import { Page } from "./page.tsx";
import { Board } from "./board-html.tsx";

export function RoomPage(props: { room: Room; player: Player }) {
  const { room, player } = props;
  // The wrapper owns the SSE connection so it survives board updates; each
  // unnamed event (a full #board fragment) morphs the inner board in place,
  // preserving the node identity the connection targets (and any in-progress
  // typing during the 1s asking-phase refreshes).
  return (
    <Page title={`${GAME_NAME} · ${room.code}`} htmx sseCode={room.code}>
      <div
        hx-sse:connect={`/rooms/${room.code}/events`}
        hx-target="find #board"
        hx-swap="outerMorph"
      >
        <Board room={room} player={player} />
      </div>
    </Page>
  );
}
