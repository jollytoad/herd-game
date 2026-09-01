import type { Player, Room } from "../rooms.ts";
import { postProps } from "./post.ts";

export function Chip(props: { room: Room; player: Player; me: Player }) {
  const { room, me } = props;
  const p = props.player;
  const isHost = me.id === room.hostId;
  const remove = isHost && p.id !== me.id
    ? (
      <button
        class="x"
        title="Remove"
        {...postProps(room.code, "remove", { "hx-vals": JSON.stringify({ id: p.id }) })}
      >
        ✕
      </button>
    )
    : null;
  const cls = p.id === me.id ? "chip me" : "chip";
  const crown = p.id === room.hostId ? " 👑" : "";
  const you = p.id === me.id ? " (you)" : "";
  return (
    <span class={cls}>
      {remove}
      {p.bot ? "🤖" : "🙂"} {p.name}
      {crown}
      {you}
    </span>
  );
}
