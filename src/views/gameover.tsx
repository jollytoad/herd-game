import type { Player, Room } from "../rooms.ts";
import { postProps } from "./post.ts";
import { Scoreboard } from "./scoreboard.tsx";

export function GameOver(props: { room: Room; player: Player }) {
  const { room, player } = props;
  const winners = room.players.filter((p) => room.winners.includes(p.id));
  const names = winners.map((w) => `${w.bot ? "🤖" : ""} ${w.name}`).join(" & ");
  return (
    <>
      <div class="winners">🏆 {names} wins!</div>
      <p class="muted">Eight cows, zero pink cows. A true member of the herd.</p>
      <div style="margin:16px 0">
        {player.id === room.hostId
          ? <button class="btn primary" {...postProps(room.code, "again")}>🔄 Play again</button>
          : <p class="muted">Waiting for the host to restart…</p>}
      </div>
      <Scoreboard room={room} />
      <div style="margin-top:20px">
        <h3 class="muted" style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase">
          Game log
        </h3>
        {room.log.map((l) => (
          <div class="log-item">
            R{l.round}: {l.question} → <b>{l.herd === null ? "no herd" : l.herd}</b>
          </div>
        ))}
      </div>
    </>
  );
}
