/** Canonical game state. The server owns this; the LLM only ever proposes
 *  verdicts which are validated then applied here. Stored in Deno KV so it
 *  survives elastic-isolate routing on Deno Deploy. */

export type Phase = "lobby" | "asking" | "judging" | "results" | "gameover";

export const WIN_COWS = 8;
export const MAX_PLAYERS = 12;

export interface Player {
  id: string;
  name: string;
  bot: boolean;
  personality: string; // bots only
  token: string; // secret, stored in a room-scoped cookie
  cows: number;
  pinkCow: boolean;
  lastSeen: number;
}

export interface JudgedAnswer {
  name: string;
  answer: string;
  inHerd: boolean;
  holdsPinkCow: boolean;
}

export interface Judgement {
  herd: string | null;
  commentary: string;
  answers: JudgedAnswer[];
}

export interface LogEntry {
  round: number;
  question: string;
  herd: string | null;
}

export interface Room {
  code: string;
  hostId: string;
  phase: Phase;
  version: number;
  createdAt: number;
  players: Player[];
  timerSeconds: number; // 0 = no time limit
  deck: string[];
  question: string | null;
  answers: Record<string, string>;
  rejects: string[]; // player ids who rejected the current question
  deadline: number | null; // epoch ms, asking phase
  botDue: Record<string, number>; // bot id -> epoch ms it should reveal its answer
  botPrepared: Record<string, string>; // bot id -> answer, generated at question flip
  judgingToken: string | null; // set when a request claims adjudication
  round: number;
  lastResult: Judgement | null;
  log: LogEntry[];
  winners: string[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** All KV keys are namespaced under this prefix to avoid colliding with other
 *  apps sharing the same Deno Deploy KV instance. Override with the
 *  KV_PREFIX env var (e.g. for staging). */
const KV_PREFIX = Deno.env.get("KV_PREFIX") ?? "herd-game";

const kv: Deno.Kv = await Deno.openKv();

function roomKey(code: string): Deno.KvKey {
  return [KV_PREFIX, "rooms", code];
}

// ---------------------------------------------------------------------------
// KV primitives (optimistic concurrency via versionstamp checks)
// ---------------------------------------------------------------------------

export async function getRoom(code: string): Promise<Room | null> {
  const entry = await kv.get<Room>(roomKey(code));
  return entry.value ?? null;
}

/** Runs `fn` against the room atomically (with retry on version conflict).
 *  Mutating `fn` must be synchronous — kick off LLM calls outside, guarded
 *  by phase checks + judgingToken claims. Returns the updated room. */
export async function updateRoom(
  code: string,
  fn: (room: Room) => void,
): Promise<Room | null> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const entry = await kv.get<Room>(roomKey(code));
    const room = entry.value;
    if (!room) return null;
    fn(room);
    room.version = entry.value.version + 1;
    const commit = await kv.atomic()
      .check({ key: roomKey(code), versionstamp: entry.versionstamp })
      .set(roomKey(code), room, { expireIn: DAY_MS })
      .commit();
    if (commit.ok) return room;
  }
  throw new Error(`could not update room ${code} after retries`);
}

// ---------------------------------------------------------------------------
// Player / room lifecycle
// ---------------------------------------------------------------------------

const CODE_RE = /^[A-Z0-9]{4}$/;

export function normCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

function genCode(): string {
  let out = "";
  for (let i = 0; i < 4; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

function secret(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function mkPlayer(name: string, bot: boolean, personality = ""): Player {
  return {
    id: crypto.randomUUID(),
    name,
    bot,
    personality,
    token: secret(),
    cows: 0,
    pinkCow: false,
    lastSeen: Date.now(),
  };
}

export async function createRoom(hostName: string): Promise<{ code: string; token: string }> {
  let code = genCode();
  while (await getRoom(code)) code = genCode();
  const host = mkPlayer(hostName, false);
  const room: Room = {
    code,
    hostId: host.id,
    phase: "lobby",
    version: 1,
    createdAt: Date.now(),
    players: [host],
    timerSeconds: 90,
    deck: [],
    question: null,
    answers: {},
    rejects: [],
    deadline: null,
    botDue: {},
    botPrepared: {},
    judgingToken: null,
    round: 0,
    lastResult: null,
    log: [],
    winners: [],
  };
  await kv.set(roomKey(code), room, { expireIn: DAY_MS });
  return { code, token: host.token };
}

export async function addPlayer(
  code: string,
  name: string,
  bot: boolean,
  personality = "",
): Promise<{ token: string } | { error: string }> {
  const existing = await getRoom(code);
  if (!existing) return { error: "Room not found." };
  if (existing.phase !== "lobby") return { error: "This game has already started." };
  if (existing.players.length >= MAX_PLAYERS) return { error: "Room is full." };
  if (existing.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: "That name is taken." };
  }
  const player = mkPlayer(name, bot, personality);
  await updateRoom(code, (r) => {
    if (r.players.length < MAX_PLAYERS && r.phase === "lobby") r.players.push(player);
  });
  return { token: player.token };
}

/** Touch a player's lastSeen (throttled so it doesn't churn versions). */
export async function touchPlayer(code: string, playerId: string): Promise<void> {
  const room = await getRoom(code);
  const player = room?.players.find((p) => p.id === playerId);
  if (!player || Date.now() - player.lastSeen < 15_000) return;
  await updateRoom(code, (r) => {
    const p = r.players.find((x) => x.id === playerId);
    if (p) p.lastSeen = Date.now();
  });
}

export const BOT_NAMES = [
  "Bessie",
  "Sir Loin",
  "Mootilda",
  "El Bovino",
  "Cowlamity Jane",
  "Moolan",
  "Heifer Nick",
  "Beefcake",
  "Moo Deng",
  "Chuck",
  "Angus",
  "Moomer",
];

export const PERSONALITIES = [
  "a hyper-competitive dad who thinks he is always right",
  "a gen-z kid who answers in internet slang",
  "a grandma whose answers are always about food",
  "a pretentious film buff",
  "an overthinker who second-guesses everything",
  "a golden retriever in human form: enthusiastic, obvious answers",
  "a lazy minimalist who gives the shortest possible answer",
  "a conspiracy theorist who overcomplicates simple prompts",
  "a millennial obsessed with 90s nostalgia",
  "a germaphobe worried about cleanliness",
  "a lawyer who answers very literally",
  "a wannabe comedian who tries to be edgy but deep down wants to fit in",
];
