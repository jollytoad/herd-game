import type { Player, Room } from "../rooms.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { doc } from "./doc.ts";
import { boardHtml } from "./board-html.ts";
import { GAME_NAME } from "../brand.ts";

export function roomPage(room: Room, player: Player): HtmlNode {
  return doc(
    `${GAME_NAME} · ${room.code}`,
    // The wrapper owns the SSE connection so it survives board updates; each
    // unnamed event (a full #board fragment) morphs the inner board in place,
    // preserving the node identity the connection targets (and any in-progress
    // typing during the 1s asking-phase refreshes).
    html`
      <div hx-sse:connect="/rooms/${room.code}/events" hx-target="find #board"
        hx-swap="outerMorph">${boardHtml(room, player)}</div>
    `,
    { htmx: true, sseCode: room.code },
  );
}
