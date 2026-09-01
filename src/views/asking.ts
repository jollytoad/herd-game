import type { Player, Room } from "../rooms.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { post } from "./post.ts";
import { scoreboard } from "./scoreboard.ts";

export function asking(room: Room, player: Player): HtmlNode {
  const answered = Object.keys(room.answers);
  const mine = room.answers[player.id];
  const remaining = room.deadline
    ? Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000))
    : null;
  const timer = remaining === null
    ? html`<span class="timer">⏳ no limit</span>`
    : html`<span class="timer${remaining <= 10 ? " low" : ""}">⏳ ${remaining}s</span>`;
  const threshold = Math.ceil(room.players.length / 2);
  const rejectState = `(${room.rejects.length}/${threshold} rejected)`;

  const form = mine !== undefined
    ? html`<div class="herd-banner" style="border-color:#4a3f7d;background:var(--bg2)">
        🔒 Locked in: <span class="answer">${mine}</span>
      </div>`
    : html`
      <form ${post(room.code, "answer")} hx-disable="find button">
        <textarea name="answer" maxlength="120"
          placeholder="Your answer… (most people will agree, right?)"
          autocomplete="off" autofocus></textarea>
        <button class="btn primary">Lock it in</button>
      </form>
    `;

  const chips = room.players.map((p) =>
    html`<span class="chip${answered.includes(p.id) ? " me" : ""}">${p.bot ? "🤖" : ""} ${p.name} ${
      answered.includes(p.id) ? "✅" : "…"
    }</span>`
  );

  return html`
    <div class="round-head"><span>Round ${room.round}</span>${timer}</div>
    <div class="qcard">${room.question ?? ""}</div>
    ${form}
    <div style="margin:12px 0">
      <button class="btn ghost small" ${post(room.code, "reject")}>🚫 Bad question</button>
      <span class="muted"> ${rejectState} — if half the room rejects, it gets tossed.</span>
    </div>
    <div class="chips">${chips}</div>
    ${scoreboard(room)}
  `;
}
