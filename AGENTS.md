# AGENTS.md

## Commands

```sh
deno task start    # run the server; stop it when done (use this one)
deno task dev      # human-facing: --watch + .env, left running
deno task gen      # REQUIRED after adding/moving a file under src/routes/
deno task ok       # fmt + lint + check  (deno task ci = the CI gates, check-only)
deno task test:e2e # bddgen && playwright test  (see Testing)
```

`deno install --frozen` first on a clean checkout. Deno 2.x; no Node, no bundler.

`deno task gen` regenerates `src/routes.ts` from the directory tree under `src/routes/`. That file
is generated — never hand-edit it, and never add a route without re-running gen. A leading `_` on a
file or path segment means "not a route" (see `scripts/route-mapper/ignore.ts`).

## Two entrypoints, and they are not interchangeable

| file      | host init                     | protocol                                                                                                 |
| --------- | ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `main.ts` | `@http/host-deno-deploy/init` | plain HTTP (Deploy terminates TLS)                                                                       |
| `dev.ts`  | `@http/host-deno-local/init`  | HTTPS **iff** `localhost-key.pem` + `localhost-cert.pem` exist in cwd (mkcert), else silently plain HTTP |

`main.ts` is the Deploy entrypoint. `host-deno-local` throws `NotCapable` unless `--allow-read=.` is
granted, because it reads the certs — that missing flag is the single most likely cause of a local
server that won't boot. The cert files are gitignored; don't remove those entries.

`.env` holds a real `OLLAMA_API_KEY` and is gitignored. It is loaded **only** by `deno task dev`
(`--env-file`), so `deno task start` runs in mock mode (see below).

## Mock mode is the determinism lever

`llmEnabled` is `OLLAMA_API_KEY.length > 0`. With no key the whole game runs on `fallbackVerdict()`
in `src/judge.ts` — a deterministic exact-match majority. Every LLM path has a deterministic
fallback, so **the game must never stall on a bad/absent model**; if you add a code path that can
hang or throw upward, that's a bug by the project's own rule.

Practical consequence: anything asserting an exact judged result must run against a mock-mode
deploy. Against a live judge, `herd_answer` is model-chosen free text — assert invariants
(`src/game.ts` `adjudicate()`) instead of the model's wording.

All KV keys are namespaced under `KV_PREFIX` (default `herd-game`) so staging/prod can share a
Deploy KV region. `Deno.openKv()` runs at module scope in `src/rooms.ts`.

## Architecture invariants worth knowing before you touch them

- **The LLM never owns state.** Room state lives in KV (`src/rooms.ts`); the judge returns a verdict
  that is zod-validated _and_ semantically checked (`validateVerdict`), retried up to 3 times with
  the error as feedback. Don't let model output mutate the room directly.
- **No `setTimeout` for game progression.** Timers and bot reveals are lazy, driven by `tickRoom()`
  from the SSE loop. That's what makes elastic-isolate routing safe — a round must advance even if
  the isolate that started it is gone.
- **Adjudication is single-claimant.** `judgingToken` + `updateRoom` optimistic concurrency ensure
  only one request runs the LLM per round. Preserve the claim, don't route around it.
- **`hx-swap="outerMorph"` is load-bearing** (`src/views/post.ts`). Replacing `#board` with
  `outerHTML` orphans the SSE stream until a full page reload. The wrapper div owning
  `hx-sse:connect` must survive board swaps too.
- The pink cow rules are the subtlest logic in the repo and are enforced in code, not just in the
  `JUDGE_RULES` prompt text: exactly one pink cow exists; only a _sole_ misser gains it; matching
  the herd sheds it; winners need ≥8 cows _and_ no pink cow.

## Testing

Gherkin + Playwright via `playwright-bdd`. Suites run against a **running deployment**
(`HERD_BASE_URL`, default `http://localhost:8000`) — the server is never started by the suite.

```sh
deno task test:e2e                        # codegen then run
deno task test:e2e:list                   # list scenarios, run nothing
deno task test:e2e --list                 # extra args forward to playwright
deno run -A npm:playwright-bdd --tags @mock   # filter by tag (codegen-time)
```

Things that will bite you:

- **`defineBddConfig()` returns the generated output dir. Capture it and pass it as `testDir`.**
  Discarding the return value is the easiest way to get a suite that collects nothing.
- **Tags are a _generation-time_ filter**, not a `playwright test` flag. `playwright test --tags`
  errors; pass `--tags` to `bddgen` instead. Note a var prefixed to `a && b` only reaches the first
  command, which is why filtering can't ride along on `deno task test:e2e`.
- **Always run through `deno task test:e2e`, never `playwright test` alone.** `bddgen` exits
  non-zero on a step with no definition and writes no spec — that's what stops a generated no-op
  step from passing vacuously. Bypass codegen and you lose that guard.
- **A feature awaiting step definitions carries `@skip` on the `Feature:` line.** `bddgen` filters
  missing-step reporting to non-skipped tests, so a skipped feature neither fails generation nor
  passes vacuously — it reports as skipped. Remove the tag when you write its steps.
- Never put a pipe between the two commands: `$?` after `cmd | tail` is `tail`'s exit code, which
  silently hides generation failures.
- Steps register via `const { Given, When, Then } = createBdd()` — **not** top-level exports and
  **not** `createStep`. For custom fixtures, extend `test` imported from `playwright-bdd`, not
  `@playwright/test`, and export the instance (generated specs need it).
- A false expectation retains `trace.zip` + `error-context.md` under `test-results/`, and the stack
  points at your step definition rather than generated code.
- Multi-player scenarios need one browser context per player: identity is a room-scoped `HttpOnly`
  cookie (`Path=/rooms/:CODE`). Rule scenarios should use three human contexts and no bots — bots
  can only be added in the lobby and their answers aren't controllable.
- Timer values are only `0 | 60 | 90 | 120`, so timer _expiry_ can't be exercised through the UI
  without waiting a real minute.

`playwright-bdd-gen/`, `test-results/`, `playwright-report/` are generated and excluded from
fmt/lint — keep them out of the repo. `test/` itself is _not_ excluded; it must stay formatted.

## CI

`.github/workflows/ci.yml` runs `deno install --frozen`, `deno fmt --check`, `deno lint`,
`deno check main.ts`. **The e2e suite is not in CI and is run manually** — don't add it there
without asking; it needs a live deployment.

`deno check` only covers `main.ts`, so test/ and route files are not typechecked by the gates. `fmt`
is `lineWidth: 100`; `jsx-key` is lint-exempt.

## Sandbox notes (this environment)

`pkill`/`pgrep` are blocked (`Cannot get process list`). Start the server with `deno task start`,
capture `$!`, and stop it with `kill $!`. Never start `deno task dev` here — `--watch` respawns and
leaves an orphan holding port 8000 that outlives the shell.
