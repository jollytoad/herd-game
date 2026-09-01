import type { Room } from "../rooms.ts";

export function Scoreboard(props: { room: Room }) {
  const room = props.room;
  const sorted = [...room.players].sort((a, b) =>
    b.cows - a.cows || Number(a.pinkCow) - Number(b.pinkCow)
  );
  const rows = sorted.map((p, i) => {
    const top = i === 0 && p.cows > 0 ? " top" : "";
    const pig = p.pinkCow ? <span class="pig">🐷 pink cow</span> : null;
    return (
      <div class={`score-row${top}`}>
        <span>
          {p.bot ? "🤖" : ""} {p.name}
          {p.id === room.hostId ? " 👑" : ""} {pig}
        </span>
        <span class="cows">
          {"🐮".repeat(Math.min(p.cows, 10))}
          {p.cows > 10 ? `×${p.cows}` : ""} <b>{p.cows}</b>/8
        </span>
      </div>
    );
  });
  return (
    <div class="scoreboard">
      <h3>Scoreboard</h3>
      {rows}
    </div>
  );
}
