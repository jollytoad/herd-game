# 🐮 Herd Intelligence — online multiplayer

Pure HTML + CSS frontend, server-rendered TS→HTML strings, htmx 4 for actions,
SSE for live board updates, Deno (`Deno.serve` only, no framework) with Deno KV
state, and an LLM referee/question-writer with a configurable OpenAI-compatible
provider.

## Run

```sh
deno task dev        # or: deno task start
# → http://localhost:8000
```

Requires Deno ≥ 2 (`pkgx deno` works too). With no `OPENAI_API_KEY` set, the
game runs in **mock mode**: canned question deck, deterministic exact-match
judge, dumb bots — useful for offline dev.

## Configuration (env vars)

| var | default | purpose |
|---|---|---|
| `OPENAI_API_KEY` | — (mock mode if unset) | API key for the LLM provider |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | any OpenAI-compatible gateway |
| `LLM_MODEL` | `gpt-4o-mini` | model for judging, questions, and bots |
| `PORT` | `8000` | listen port |

## Rules implemented (variants agreed)

- 3–12 players (bots allowed, LLM-personality driven).
- Simultaneous secret answers; configurable per-round timer (60/90/120s/∞).
  Unanswered players submit "(no answer)" when time expires.
- The LLM judge finds the **herd answer**, treating synonyms/rewordings as one
  answer; ties → **no herd**, nobody scores.
- Matching the herd: +1 🐮 and you shed the pink cow. Missing the herd **on any
  question**: you're stuck with the 🐷 pink cow until you match a herd again.
- First to **8 cows without holding the pink cow** wins (win check is pure code).
- Any player can hit "Bad question"; when a majority rejects, the question is
  discarded and a new one is drawn.

## Architecture

```
main.ts            Deno.serve + hand-rolled router (no framework)
src/rooms.ts       Types + Deno KV storage (optimistic-concurrency updates)
src/game.ts        Phase machine, lazy timers, bot scheduling, adjudication
src/judge.ts       LLM prompts, zod verdict schema, agent retry loop, fallbacks
src/views.ts       TS template literals → HTML (pages + swappable #board)
style.css          The one stylesheet
```

- **State owner:** the server (Deno KV, key `["rooms", CODE]`). The LLM never
  stores state; each round it receives the rules + question + all answers and
  returns a verdict JSON, validated by zod *and* semantic checks (matched ids
  exist, no-herd consistency, "(no answer)" can't win). Invalid output goes
  back to the model with the error as feedback (up to 3 attempts), then falls
  back to a deterministic exact-match majority so the game never stalls.
- **Live updates:** every page holds one `EventSource` to
  `/rooms/:code/events`. The SSE loop calls `tickRoom()` once per second —
  which lazily expires timers and schedules bot answers — and pushes a fresh
  `#board` HTML fragment on every state-version change (every second while
  answers are open, so the countdown is live).
- **Actions:** htmx 4 `hx-post` → the server replies with a new `#board`
  fragment (`hx-target="#board" hx-swap="outerHTML"`). htmx 4 has no SSE
  extension yet (the 2.x one targets the old extension API), so the 7-line
  EventSource listener lives inline in the page.
- **Identity:** room-scoped cookie (`Path=/rooms/:CODE`) holding a per-player
  secret; refreshing reattaches you to your seat.
- **Answers are untrusted data:** the judge prompt instructs the model to
  ignore instructions inside answers, and code-level validation constrains
  what a verdict can change.

## Deno Deploy notes

- State is in Deno KV, so elastic-isolate routing is safe. Timers/bots are
  driven lazily by the SSE tick, not `setTimeout`, so no isolate needs to stay
  alive for the game to progress.
- `Deno.openKv()` needs `--unstable-kv` locally; on Deploy it's enabled by
  default. Rooms expire after 24h of no writes (KV `expireIn`, refreshed on
  every update).
