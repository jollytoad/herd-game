import { MAX_PLAYERS, type Player, type Room } from "../rooms.ts";
import { canStart } from "../game.ts";
import { Chip } from "./chip.tsx";
import { postProps } from "./post.ts";
import { Scoreboard } from "./scoreboard.tsx";

export function Lobby(props: { room: Room; player: Player }) {
  const { room, player } = props;
  const isHost = player.id === room.hostId;
  const timerBtns = [60, 90, 120, 0].map((s) => (
    <button
      class={`btn small${room.timerSeconds === s ? " primary" : ""}`}
      {...(isHost
        ? postProps(room.code, "timer", { "hx-vals": JSON.stringify({ seconds: s }) })
        : { disabled: true })}
    >
      {s === 0 ? "∞" : `${s}s`}
    </button>
  ));
  const startable = canStart(room);
  return (
    <>
      <div class="card">
        <h2>Room code</h2>
        <div class="big-code">{room.code}</div>
        <p class="muted">Friends: open this site and enter the code above.</p>
        <div class="chips">
          {room.players.map((p) => <Chip room={room} player={p} me={player} />)}
        </div>
        <div>
          <span class="muted">Answer timer:</span> {timerBtns}
        </div>
        {isHost
          ? (
            <button
              class="btn"
              {...(room.players.length < MAX_PLAYERS
                ? postProps(room.code, "bot")
                : { disabled: true })}
            >
              🤖 Add bot player
            </button>
          )
          : null}
        <div style="margin-top:12px">
          {isHost
            ? (
              <button
                class="btn primary"
                {...(startable ? postProps(room.code, "start") : { disabled: true })}
                title={startable ? "" : "Need at least 3 players (bots count)"}
              >
                ▶ Start game
              </button>
            )
            : <p class="muted">Waiting for the host to start…</p>}
        </div>
      </div>
      <Scoreboard room={room} />
    </>
  );
}
