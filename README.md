# 🐮 Herd Intelligence — online multiplayer

Pure HTML + CSS frontend, server-rendered TS→HTML strings, htmx 4 for actions, SSE for live board
updates, Deno (`Deno.serve` only, no framework) with Deno KV state, and an LLM
referee/question-writer powered by the [Ollama Cloud](https://docs.ollama.com/cloud) REST API.

## Run

```sh
deno task dev        # or: deno task start
# → http://localhost:8000
```

Requires Deno ≥ 2 (`pkgx deno` works too). With no `OLLAMA_API_KEY` set, the game runs in **mock
mode**: canned question deck, deterministic exact-match judge, dumb bots — useful for offline dev.

## Configuration (env vars)

| var               | default                | purpose                                |
| ----------------- | ---------------------- | -------------------------------------- |
| `OLLAMA_API_KEY`  | — (mock mode if unset) | API key for Ollama Cloud               |
| `OLLAMA_BASE_URL` | `https://ollama.com`   | Ollama-compatible endpoint             |
| `LLM_MODEL`       | `gpt-oss:120b`         | model for judging, questions, and bots |
| `PORT`            | `8000`                 | listen port                            |

## OpenTelemetry (dev)

Deno's built-in OTel integration is enabled in dev tasks via `OTEL_DENO=true`:

- `deno task dev` — console exporter: spans, metrics and logs print to stderr. Zero infrastructure.
- `deno task dev:otlp` — exports OTLP to `localhost:4318` (override with
  `OTEL_EXPORTER_OTLP_ENDPOINT`). Pair with `deno task otel`, which runs the Grafana LGTM stack in
  Docker (dashboard at `http://localhost:3000`, login `admin`/`admin`).
- `deno task start` (prod) has telemetry disabled.

What you get:

- **Auto-instrumented**: a `Server` span per HTTP request, `Client` spans for every outbound `fetch`
  (i.e. every LLM call), plus runtime metrics and logs.
- **Custom spans** (via `npm:@opentelemetry/api`, a no-op in prod): `game.draw_question` →
  `judge.generate_questions` / `judge.round` → `llm.chat`, with attributes for model, judge
  attempts, herd-found, winner count and room/round — and recorded exceptions on retry/fallback, so
  the agent loop's failed attempts show up as exception events on the spans.

## Rules implemented (variants agreed)

- 3–12 players (bots allowed, LLM-personality driven).
- Simultaneous secret answers; configurable per-round timer (60/90/120s/∞). Unanswered players
  submit "(no answer)" when time expires.
- The LLM judge finds the **herd answer**, treating synonyms/rewordings as one answer; ties → **no
  herd**, nobody scores.
- Matching the herd: +1 🐮 and you shed the pink cow. There is only **one** pink cow: if you are the
  **only** player to miss the herd, you're stuck with the 🐷 pink cow until you match a herd again;
  if several players miss, nobody gains it and existing holders keep it.
- First to **8 cows without holding the pink cow** wins (win check is pure code).
- Any player can hit "Bad question"; when a majority rejects, the question is discarded and a new
  one is drawn.

## Architecture

```
main.ts            Deno.serve + hand-rolled router (no framework)
src/rooms.ts       Types + Deno KV storage (optimistic-concurrency updates)
src/game.ts        Phase machine, lazy timers, bot scheduling, adjudication
src/judge.ts       LLM prompts, zod verdict schema, agent retry loop, fallbacks
src/views.ts       TS template literals → HTML (pages + swappable #board)
style.css          The one stylesheet
```

- **State owner:** the server (Deno KV, key `["rooms", CODE]`). The LLM never stores state; each
  round it receives the rules + question + all answers and returns a verdict JSON, validated by zod
  _and_ semantic checks (matched ids exist, no-herd consistency, "(no answer)" can't win). Invalid
  output goes back to the model with the error as feedback (up to 3 attempts), then falls back to a
  deterministic exact-match majority so the game never stalls.
- **Live updates:** each room page holds one persistent SSE connection via htmx 4's bundled
  [`hx-sse`](https://four.htmx.org/extensions/hx-sse) extension (`hx-sse:connect`). The SSE loop
  calls `tickRoom()` once per second — which lazily expires timers and schedules bot answers — and
  pushes the board as an unnamed event (a fresh `#board` HTML fragment) on every state-version
  change (every second while answers are open, so the countdown is live). The connection lives on a
  wrapper element so it survives swaps.
- **Actions:** htmx 4 `hx-post` → the server replies with a new `#board` fragment
  (`hx-target="#board" hx-swap="outerHTML"`). Live board updates come from htmx 4's `hx-sse`
  extension (unnamed SSE events auto-swap into the target); no inline client JS is needed.
- **Identity:** room-scoped cookie (`Path=/rooms/:CODE`) holding a per-player secret; refreshing
  reattaches you to your seat.
- **Answers are untrusted data:** the judge prompt instructs the model to ignore instructions inside
  answers, and code-level validation constrains what a verdict can change.

## Deno Deploy notes

- State is in Deno KV, so elastic-isolate routing is safe. Timers/bots are driven lazily by the SSE
  tick, not `setTimeout`, so no isolate needs to stay alive for the game to progress.
- `Deno.openKv()` needs `--unstable-kv` locally; on Deploy it's enabled by default. Rooms expire
  after 24h of no writes (KV `expireIn`, refreshed on every update).
- **Permissions:** env access is scoped to exactly the four variables read (`PORT`,
  `OLLAMA_API_KEY`, `OLLAMA_BASE_URL`, `LLM_MODEL`). `--allow-net` stays unscoped because the server
  both listens on `PORT` and makes outbound fetches to whichever LLM gateway `OLLAMA_BASE_URL`
  points at.
- `deno task ci` runs the same gates locally as CI: `fmt --check`, `lint`, `check`.
