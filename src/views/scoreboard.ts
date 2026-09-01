import type { Room } from "../rooms.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";

export function scoreboard(room: Room): HtmlNode {
  const sorted = [...room.players].sort((a, b) =>
    b.cows - a.cows || Number(a.pinkCow) - Number(b.pinkCow)
  );
  const rows = sorted.map((p, i) => {
    const top = i === 0 && p.cows > 0 ? " top" : "";
    const pig = p.pinkCow ? `<span class="pig">🐷 pink cow</span>` : "";
    return html`
      <div class="score-row${top}">
        <span>${p.bot ? "🤖" : ""} ${p.name}${p.id === room.hostId ? " 👑" : ""} ${pig}</span>
        <span class="cows">${"🐮".repeat(Math.min(p.cows, 10))}${p.cows > 10
          ? `×${p.cows}`
          : ""} <b>${p.cows}</b>/8</span>
      </div>
    `;
  });
  return html`<div class="scoreboard"><h3>Scoreboard</h3>${rows}</div>`;
}
