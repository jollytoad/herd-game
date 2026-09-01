import type { Player, Room } from "../rooms.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { judging } from "./judging.ts";
import { post } from "./post.ts";
import { scoreboard } from "./scoreboard.ts";

export function results(room: Room, player: Player): HtmlNode {
  const r = room.lastResult;
  if (!r) return judging();
  const herd = r.herd === null
    ? html`<div class="herd-banner no-herd">😶 No herd this round — nobody scores.</div>`
    : html`<div class="herd-banner">🐮 The herd said: <span class="answer">“${r.herd}”</span></div>`;

  const rows = r.answers.map((a) =>
    html`
      <div class="answer-row${a.inHerd ? " herd" : ""}">
        <span class="who">${a.name}:</span>
        <span style="flex:1;text-align:left">“${a.answer}”</span>
        <span class="badge">${a.inHerd
          ? "✅ herd · +1 🐮"
          : a.holdsPinkCow
          ? "🐷 pink cow"
          : r.herd === null
          ? "❌ no herd"
          : "❌ missed"}</span>
      </div>
    `
  );

  const me = room.players.find((p) => p.id === player.id);
  const pigNote = me?.pinkCow
    ? html`
      <div
        class="pinkcow-note">🐷 You're stuck with the pink cow! Match the herd next round to ditch it — you can't win while you hold it.</div>
    `
    : "";

  const next = player.id === room.hostId
    ? html`<button class="btn primary" ${post(room.code, "next")}>Next round →</button>`
    : html`<p class="muted">Waiting for the host to start the next round…</p>`;

  const log = room.log.slice(0, 6).map((l) =>
    `<div class="log-item">R${l.round}: ${l.question} → <b>${
      l.herd === null ? "no herd" : l.herd
    }</b></div>`
  );

  return html`
    ${herd}
    <div class="commentary">🤖 ${r.commentary}</div>
    <div style="text-align:left;max-width:560px;margin:0 auto">${rows}</div>
    ${pigNote}
    <div style="margin:18px 0">${next}</div>
    <div
      style="margin-top:20px"><h3 class="muted" style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase">Recent rounds</h3>${log}</div>
    ${scoreboard(room)}
  `;
}
