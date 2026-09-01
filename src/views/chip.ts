import type { Player, Room } from "../rooms.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { post } from "./post.ts";

export function chip(room: Room, p: Player, me: Player): HtmlNode {
  const isHost = me.id === room.hostId;
  const remove = isHost && p.id !== me.id
    ? html`<button class="x" title="Remove" ${
      post(room.code, "remove", ` hx-vals='{"id":"${p.id}"}'`)
    }>✕</button>`
    : "";
  const cls = p.id === me.id ? "chip me" : "chip";
  const crown = p.id === room.hostId ? " 👑" : "";
  const you = p.id === me.id ? " (you)" : "";
  return html`<span class="${cls}">${remove}${p.bot ? "🤖" : "🙂"} ${p.name}${crown}${you}</span>`;
}
