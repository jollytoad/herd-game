/** Server-rendered HTML. Pure template literals, no framework.
 *  `boardHtml(...)` is swapped into #board by htmx (action POSTs) and by a
 *  tiny EventSource listener (SSE "board" events). */

import { MAX_PLAYERS, type Player, type Room } from "./rooms.ts";
import { canStart } from "./game.ts";
import { GAME_NAME, TAGLINE } from "./brand.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/** Title with the last word in the accent colour: Herd <pink>Intelligence</pink>. */
function titleHtml(): HtmlNode {
  const words = GAME_NAME.split(" ");
  const last = words.pop() ?? "";
  return html`${words.join(" ")} <span class="pink">${last}</span>`;
}

function doc(
  title: string,
  body: HtmlNode,
  opts: { htmx?: boolean; sseCode?: string } = {},
): HtmlNode {
  return html`
    <html lang="en">
      <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <link rel="stylesheet" href="/style.css">
    ${opts.htmx
      ? html`<script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0/dist/htmx.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0/dist/ext/hx-sse.min.js" defer></script>`
      : ""}
      </head>
      <body>
        <header>🐮 ${GAME_NAME}${opts.sseCode
          ? html`
            · room <b>${opts.sseCode}</b>
          `
          : ""}</header>
        <main>
    ${body}
        </main>
      </body>
    </html>
  `;
}

export function landingPage(): HtmlNode {
  return doc(
    GAME_NAME,
    html`
      <h1>🐮 ${titleHtml()}</h1>
      <p class="tag">${TAGLINE}</p>
      <div class="cards">
        <form class="card" method="post" action="/rooms">
          <h2>Create a room</h2>
          <input type="text" name="name" placeholder="Your name" required maxlength="24"
            autocomplete="off">
          <button class="btn primary">Create room</button>
        </form>
        <form class="card" method="post" action="/rooms/join">
          <h2>Join a room</h2>
          <input type="text" name="code" placeholder="ROOM CODE" required maxlength="4" minlength="4"
            style="text-transform:uppercase;letter-spacing:0.3em;text-align:center" autocomplete="off">
          <input type="text" name="name" placeholder="Your name" required maxlength="24"
            autocomplete="off">
          <button class="btn primary">Join</button>
        </form>
      </div>
      <div class="rules-blurb">
        Each round everyone secretly answers the same prompt. The LLM referee finds the
        <b>herd answer</b> — the most common one, synonyms included. Match the herd and you
        score a cow. Miss it and you're stuck holding the <b>pink cow</b> 🐷 until you match
        the herd again. First to 8 cows <i>without</i> the pink cow wins.
      </div>
    `,
  );
}

export function joinPage(code: string, error?: string): HtmlNode {
  return doc(
    "Join room",
    html`
      <h1>🐮 Join room</h1>
      <form class="card" method="post" action="/rooms/${code}/join">
        <div class="big-code">${code}</div>
        <input type="text" name="name" placeholder="Your name" required maxlength="24" autofocus autocomplete="off">
        ${error ? html`<p class="error">${error}</p>` : ""}
        <button class="btn primary">Join</button>
      </form>
      <p class="muted"><a class="muted" href="/">← back</a></p>
    `,
  );
}

export function roomPage(room: Room, player: Player): HtmlNode {
  return doc(
    `${GAME_NAME} · ${room.code}`,
    // The wrapper owns the SSE connection so it survives board updates; each
    // unnamed event (a full #board fragment) morphs the inner board in place,
    // preserving the node identity the connection targets (and any in-progress
    // typing during the 1s asking-phase refreshes).
    html`
      <div hx-sse:connect="/rooms/${room.code}/events" hx-target="find #board"
        hx-swap="outerMorph">${boardHtml(room, player)}</div>
    `,
    { htmx: true, sseCode: room.code },
  );
}

export function errorPage(message?: string): HtmlNode {
  return doc(
    "Error",
    html`
      <h1>🐮 Moo-ving on…</h1>
      <div class="card">
        <p>${message ?? "Something went wrong. The herd apologises."}</p>
      </div>
      <p><a class="muted" href="/">← back to the barn</a></p>
    `,
  );
}

// ---------------------------------------------------------------------------
// Board (the SSE/htmx-swapped fragment)
// ---------------------------------------------------------------------------

function post(code: string, action: string, extra = ""): HtmlNode {
  // outerMorph (not outerHTML) keeps the #board DOM node identical — the
  // hx-sse connection holds that node as its swap target, and replacing it
  // would orphan the live SSE stream until the next full page load.
  return html`hx-post="/rooms/${code}/${action}" hx-target="#board" hx-swap="outerMorph"${extra}`;
}

export function boardHtml(room: Room, player: Player): HtmlNode {
  return html`<div id="board">${boardInner(room, player)}</div>`;
}

function boardInner(room: Room, player: Player): HtmlNode {
  return room.phase === "lobby"
    ? lobby(room, player)
    : room.phase === "asking"
    ? asking(room, player)
    : room.phase === "judging"
    ? judging()
    : room.winners.length > 0
    ? gameover(room, player)
    : results(room, player);
}

// ---------------------------------------------------------------------------

function chip(room: Room, p: Player, me: Player): HtmlNode {
  const isHost = me.id === room.hostId;
  const remove = isHost && p.id !== me.id
    ? html`<button class="x" title="Remove" ${
      post(room.code, "remove", ` hx-vals='{"id":"${p.id}"}'`)
    }>✕</button>`
    : "";
  const cls = p.id === me.id ? "chip me" : "chip";
  const crown = p.id === room.hostId ? " 👑" : "";
  const you = p.id === me.id ? " (you)" : "";
  return html`<span class="${cls}">${remove}${p.bot ? "🤖" : "🙂"} ${p.name}${crown}${you}</span>`;
}

function scoreboard(room: Room): HtmlNode {
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

// ---------------------------------------------------------------------------

function lobby(room: Room, player: Player): HtmlNode {
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

// ---------------------------------------------------------------------------

function asking(room: Room, player: Player): HtmlNode {
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

// ---------------------------------------------------------------------------

function judging(): HtmlNode {
  return html`
    <div class="spinner"></div>
    <p class="muted">The herd is deliberating… the LLM referee is comparing notes.</p>
  `;
}

// ---------------------------------------------------------------------------

function results(room: Room, player: Player): HtmlNode {
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

// ---------------------------------------------------------------------------

function gameover(room: Room, player: Player): HtmlNode {
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
