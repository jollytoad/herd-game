import { MAX_PLAYERS, type Player, type Room } from "../rooms.ts";
import { canStart } from "../game.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { chip } from "./chip.ts";
import { post } from "./post.ts";
import { scoreboard } from "./scoreboard.ts";

export function lobby(room: Room, player: Player): HtmlNode {
  const isHost = player.id === room.hostId;
  const players = room.players.map((p) => chip(room, p, player));
  const timerBtns = [60, 90, 120, 0].map((s) => {
    const active = room.timerSeconds === s ? " primary" : "";
    const attrs = isHost ? post(room.code, "timer", ` hx-vals='{"seconds":${s}}'`) : "disabled";
    return html`<button class="btn small${active}" ${attrs}>${s === 0 ? "∞" : `${s}s`}</button>`;
  });
  const startable = canStart(room);
  const start = isHost
    ? html`<button class="btn primary" ${
      startable ? post(room.code, "start") : "disabled"
    } title="${startable ? "" : "Need at least 3 players (bots count)"}">▶ Start game</button>`
    : `<p class="muted">Waiting for the host to start…</p>`;

  return html`
    <div class="card">
      <h2>Room code</h2>
      <div class="big-code">${room.code}</div>
      <p class="muted">Friends: open this site and enter the code above.</p>
      <div class="chips">${players}</div>
      <div>
        <span class="muted">Answer timer:</span> ${timerBtns}
      </div>
      ${isHost
        ? html`<button class="btn" ${
          room.players.length < MAX_PLAYERS ? post(room.code, "bot") : "disabled"
        }>🤖 Add bot player</button>`
        : ""}
      <div style="margin-top:12px">${start}</div>
    </div>
    ${scoreboard(room)}
  `;
}
