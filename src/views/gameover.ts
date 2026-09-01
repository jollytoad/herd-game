import type { Player, Room } from "../rooms.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { post } from "./post.ts";
import { scoreboard } from "./scoreboard.ts";

export function gameover(room: Room, player: Player): HtmlNode {
  const winners = room.players.filter((p) => room.winners.includes(p.id));
  const names = winners.map((w) => `${w.bot ? "🤖" : ""} ${w.name}`).join(" & ");
  const again = player.id === room.hostId
    ? html`<button class="btn primary" ${post(room.code, "again")}>🔄 Play again</button>`
    : html`<p class="muted">Waiting for the host to restart…</p>`;
  return html`
    <div class="winners">🏆 ${names} wins!</div>
    <p class="muted">Eight cows, zero pink cows. A true member of the herd.</p>
    <div style="margin:16px 0">${again}</div>
    ${scoreboard(room)}
    <div
      style="margin-top:20px"><h3 class="muted" style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase">Game log</h3>${room
        .log.map((l) =>
          html`<div class="log-item">R${l.round}: ${l.question} → <b>${
            l.herd === null ? "no herd" : l.herd
          }</b></div>`
        )}</div>
  `;
}
