import type { Player, Room } from "../rooms.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { boardInner } from "./board-inner.ts";

export function boardHtml(room: Room, player: Player): HtmlNode {
  return html`<div id="board">${boardInner(room, player)}</div>`;
}
