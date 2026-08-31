/** Server-rendered HTML. Pure template literals, no framework.
 *  `boardHtml(...)` is swapped into #board by htmx (action POSTs) and by a
 *  tiny EventSource listener (SSE "board" events). */

import { MAX_PLAYERS, type Player, type Room } from "./rooms.ts";
import { canStart } from "./game.ts";
import { GAME_NAME, TAGLINE } from "./brand.ts";

export function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/** Title with the last word in the accent colour: Herd <pink>Intelligence</pink>. */
function titleHtml(): string {
  const words = GAME_NAME.split(" ");
  const last = words.pop() ?? "";
  return `${words.join(" ")} <span class="pink">${esc(last)}</span>`.trim();
}

function doc(title: string, body: string, opts: { htmx?: boolean; sseCode?: string } = {}): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/style.css">
${
    opts.htmx
      ? `<script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0/dist/htmx.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0/dist/ext/hx-sse.min.js" defer></script>`
      : ""
  }
</head>
<body>
<header>🐮 ${esc(GAME_NAME)}${opts.sseCode ? ` · room <b>${esc(opts.sseCode)}</b>` : ""}</header>
<main>
${body}
</main>
</body>
</html>`;
}

export function landingPage(): string {
  return doc(
    GAME_NAME,
    `
<h1>🐮 ${titleHtml()}</h1>
<p class="tag">${TAGLINE}</p>
<div class="cards">
  <form class="card" method="post" action="/rooms">
    <h2>Create a room</h2>
    <input type="text" name="name" placeholder="Your name" required maxlength="24" autocomplete="off">
    <button class="btn primary">Create room</button>
  </form>
  <form class="card" method="post" action="/rooms/join">
    <h2>Join a room</h2>
    <input type="text" name="code" placeholder="ROOM CODE" required maxlength="4" minlength="4"
      style="text-transform:uppercase;letter-spacing:0.3em;text-align:center" autocomplete="off">
    <input type="text" name="name" placeholder="Your name" required maxlength="24" autocomplete="off">
    <button class="btn primary">Join</button>
  </form>
</div>
<div class="rules-blurb">
  Each round everyone secretly answers the same prompt. The LLM referee finds the
  <b>herd answer</b> — the most common one, synonyms included. Match the herd and you
  score a cow. Miss it and you're stuck holding the <b>pink cow</b> 🐷 until you match
  the herd again. First to 8 cows <i>without</i> the pink cow wins.
</div>`,
  );
}

export function joinPage(code: string, error?: string): string {
  return doc(
    "Join room",
    `
<h1>🐮 Join room</h1>
<form class="card" method="post" action="/rooms/${esc(code)}/join">
  <div class="big-code">${esc(code)}</div>
  <input type="text" name="name" placeholder="Your name" required maxlength="24" autofocus autocomplete="off">
  ${error ? `<p class="error">${esc(error)}</p>` : ""}
  <button class="btn primary">Join</button>
</form>
<p class="muted"><a class="muted" href="/">← back</a></p>`,
  );
}

export function roomPage(room: Room, player: Player): string {
  return doc(
    `${GAME_NAME} · ${room.code}`,
    // The wrapper owns the SSE connection so it survives board swaps; each
    // unnamed event (a full #board fragment) replaces the inner board.
    `<div hx-sse:connect="/rooms/${
      esc(room.code)
    }/events" hx-target="find #board" hx-swap="outerHTML">${boardHtml(room, player)}</div>`,
    { htmx: true, sseCode: room.code },
  );
}

export function errorPage(message?: string): string {
  return doc(
    "Error",
    `
<h1>🐮 Moo-ving on…</h1>
<div class="card"><p>${esc(message ?? "Something went wrong. The herd apologises.")}</p></div>
<p><a class="muted" href="/">← back to the barn</a></p>`,
  );
}

// ---------------------------------------------------------------------------
// Board (the SSE/htmx-swapped fragment)
// ---------------------------------------------------------------------------

function post(code: string, action: string, extra = ""): string {
  return `hx-post="/rooms/${esc(code)}/${action}" hx-target="#board" hx-swap="outerHTML"${extra}`;
}

export function boardHtml(room: Room, player: Player): string {
  return `<div id="board">${boardInner(room, player)}</div>`;
}

function boardInner(room: Room, player: Player): string {
  const inner = room.phase === "lobby"
    ? lobby(room, player)
    : room.phase === "asking"
    ? asking(room, player)
    : room.phase === "judging"
    ? judging()
    : room.winners.length > 0
    ? gameover(room, player)
    : results(room, player);
  return inner;
}

// ---------------------------------------------------------------------------

function chip(room: Room, p: Player, me: Player): string {
  const isHost = me.id === room.hostId;
  const remove = isHost && p.id !== me.id
    ? `<button class="x" title="Remove" ${
      post(room.code, "remove", ` hx-vals='{"id":"${p.id}"}'`)
    }>✕</button>`
    : "";
  const cls = p.id === me.id ? "chip me" : "chip";
  const crown = p.id === room.hostId ? " 👑" : "";
  const you = p.id === me.id ? " (you)" : "";
  return `<span class="${cls}">${remove}${p.bot ? "🤖" : "🙂"} ${esc(p.name)}${crown}${you}</span>`;
}

function scoreboard(room: Room): string {
  const sorted = [...room.players].sort((a, b) =>
    b.cows - a.cows || Number(a.pinkCow) - Number(b.pinkCow)
  );
  const rows = sorted.map((p, i) => {
    const top = i === 0 && p.cows > 0 ? " top" : "";
    const pig = p.pinkCow ? `<span class="pig">🐷 pink cow</span>` : "";
    return `<div class="score-row${top}">
      <span>${p.bot ? "🤖" : ""} ${esc(p.name)}${p.id === room.hostId ? " 👑" : ""} ${pig}</span>
      <span class="cows">${"🐮".repeat(Math.min(p.cows, 10))}${
      p.cows > 10 ? `×${p.cows}` : ""
    } <b>${p.cows}</b>/8</span>
    </div>`;
  }).join("");
  return `<div class="scoreboard"><h3>Scoreboard</h3>${rows}</div>`;
}

// ---------------------------------------------------------------------------

function lobby(room: Room, player: Player): string {
  const isHost = player.id === room.hostId;
  const players = room.players.map((p) => chip(room, p, player)).join("");
  const timerBtns = [60, 90, 120, 0].map((s) => {
    const active = room.timerSeconds === s ? " primary" : "";
    const attrs = isHost ? post(room.code, "timer", ` hx-vals='{"seconds":${s}}'`) : "disabled";
    return `<button class="btn small${active}" ${attrs}>${s === 0 ? "∞" : `${s}s`}</button>`;
  }).join("");
  const startable = canStart(room);
  const start = isHost
    ? `<button class="btn primary" ${startable ? post(room.code, "start") : "disabled"} title="${
      startable ? "" : "Need at least 3 players (bots count)"
    }">▶ Start game</button>`
    : `<p class="muted">Waiting for the host to start…</p>`;

  return `
<div class="card">
  <h2>Room code</h2>
  <div class="big-code">${esc(room.code)}</div>
  <p class="muted">Friends: open this site and enter the code above.</p>
  <div class="chips">${players}</div>
  <div>
    <span class="muted">Answer timer:</span> ${timerBtns}
  </div>
  ${
    isHost
      ? `<button class="btn" ${
        room.players.length < MAX_PLAYERS ? post(room.code, "bot") : "disabled"
      }>🤖 Add bot player</button>`
      : ""
  }
  <div style="margin-top:12px">${start}</div>
</div>
${scoreboard(room)}`;
}

// ---------------------------------------------------------------------------

function asking(room: Room, player: Player): string {
  const answered = Object.keys(room.answers);
  const mine = room.answers[player.id];
  const remaining = room.deadline
    ? Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000))
    : null;
  const timer = remaining === null
    ? `<span class="timer">⏳ no limit</span>`
    : `<span class="timer${remaining <= 10 ? " low" : ""}">⏳ ${remaining}s</span>`;
  const threshold = Math.ceil(room.players.length / 2);
  const rejectState = `(${room.rejects.length}/${threshold} rejected)`;

  const form = mine !== undefined
    ? `<div class="herd-banner" style="border-color:#4a3f7d;background:var(--bg2)">
        🔒 Locked in: <span class="answer">${esc(mine)}</span>
      </div>`
    : `<form ${post(room.code, "answer")} hx-disable="find button">
        <textarea name="answer" maxlength="120" placeholder="Your answer… (most people will agree, right?)"
          autocomplete="off" autofocus></textarea>
        <button class="btn primary">Lock it in</button>
      </form>`;

  const chips = room.players.map((p) =>
    `<span class="chip${answered.includes(p.id) ? " me" : ""}">${p.bot ? "🤖" : ""} ${
      esc(p.name)
    } ${answered.includes(p.id) ? "✅" : "…"}</span>`
  ).join("");

  return `
<div class="round-head"><span>Round ${room.round}</span>${timer}</div>
<div class="qcard">${esc(room.question ?? "")}</div>
${form}
<div style="margin:12px 0">
  <button class="btn ghost small" ${post(room.code, "reject")}>🚫 Bad question</button>
  <span class="muted"> ${rejectState} — if half the room rejects, it gets tossed.</span>
</div>
<div class="chips">${chips}</div>
${scoreboard(room)}`;
}

// ---------------------------------------------------------------------------

function judging(): string {
  return `
<div class="spinner"></div>
<p class="muted">The herd is deliberating… the LLM referee is comparing notes.</p>`;
}

// ---------------------------------------------------------------------------

function results(room: Room, player: Player): string {
  const r = room.lastResult;
  if (!r) return judging();
  const herd = r.herd === null
    ? `<div class="herd-banner no-herd">😶 No herd this round — nobody scores.</div>`
    : `<div class="herd-banner">🐮 The herd said: <span class="answer">“${
      esc(r.herd)
    }”</span></div>`;

  const rows = r.answers.map((a) =>
    `<div class="answer-row${a.inHerd ? " herd" : ""}">
      <span class="who">${esc(a.name)}:</span>
      <span style="flex:1;text-align:left">“${esc(a.answer)}”</span>
      <span class="badge">${
      a.inHerd ? "✅ herd · +1 🐮" : r.herd === null ? "❌ no herd" : "🐷 pink cow"
    }</span>
    </div>`
  ).join("");

  const me = room.players.find((p) => p.id === player.id);
  const pigNote = me?.pinkCow
    ? `<div class="pinkcow-note">🐷 You're stuck with the pink cow! Match the herd next round to ditch it — you can't win while you hold it.</div>`
    : "";

  const next = player.id === room.hostId
    ? `<button class="btn primary" ${post(room.code, "next")}>Next round →</button>`
    : `<p class="muted">Waiting for the host to start the next round…</p>`;

  const log = room.log.slice(0, 6).map((l) =>
    `<div class="log-item">R${l.round}: ${esc(l.question)} → <b>${
      l.herd === null ? "no herd" : esc(l.herd)
    }</b></div>`
  ).join("");

  return `
${herd}
<div class="commentary">🤖 ${esc(r.commentary)}</div>
<div style="text-align:left;max-width:560px;margin:0 auto">${rows}</div>
${pigNote}
<div style="margin:18px 0">${next}</div>
<div style="margin-top:20px"><h3 class="muted" style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase">Recent rounds</h3>${log}</div>
${scoreboard(room)}`;
}

// ---------------------------------------------------------------------------

function gameover(room: Room, player: Player): string {
  const winners = room.players.filter((p) => room.winners.includes(p.id));
  const names = winners.map((w) => `${w.bot ? "🤖" : ""} ${esc(w.name)}`).join(" & ");
  const again = player.id === room.hostId
    ? `<button class="btn primary" ${post(room.code, "again")}>🔄 Play again</button>`
    : `<p class="muted">Waiting for the host to restart…</p>`;
  return `
<div class="winners">🏆 ${names} wins!</div>
<p class="muted">Eight cows, zero pink cows. A true member of the herd.</p>
<div style="margin:16px 0">${again}</div>
${scoreboard(room)}
<div style="margin-top:20px"><h3 class="muted" style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase">Game log</h3>${
    room.log.map((l) =>
      `<div class="log-item">R${l.round}: ${esc(l.question)} → <b>${
        l.herd === null ? "no herd" : esc(l.herd)
      }</b></div>`
    ).join("")
  }</div>`;
}
