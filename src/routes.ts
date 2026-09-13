import { cascade } from "@http/route/cascade";
import { byPattern } from "@http/route/by-pattern";
import { byMethod } from "@http/route/by-method";
import { lazy } from "@http/route/lazy";

export default cascade(
  byPattern("/", lazy(async () => byMethod(await import("./routes/index.ts")))),
  byPattern("/rooms", lazy(async () => byMethod(await import("./routes/rooms.ts")))),
  // must precede /rooms/:code — otherwise "join" is swallowed as a room code
  byPattern(
    "/rooms/join",
    lazy(async () => byMethod(await import("./routes/rooms/join.ts"))),
  ),
  byPattern(
    "/rooms/:code",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/index.ts"))),
  ),
  byPattern(
    "/rooms/:code/events",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/events.ts"))),
  ),
  byPattern(
    "/rooms/:code/join",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/join.ts"))),
  ),
  // --- game actions (one file per action; _helpers.ts does the seat auth) ---
  byPattern(
    "/rooms/:code/start",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/start.ts"))),
  ),
  byPattern(
    "/rooms/:code/answer",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/answer.ts"))),
  ),
  byPattern(
    "/rooms/:code/reject",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/reject.ts"))),
  ),
  byPattern(
    "/rooms/:code/next",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/next.ts"))),
  ),
  byPattern(
    "/rooms/:code/bot",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/bot.ts"))),
  ),
  byPattern(
    "/rooms/:code/remove",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/remove.ts"))),
  ),
  byPattern(
    "/rooms/:code/timer",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/timer.ts"))),
  ),
  byPattern(
    "/rooms/:code/again",
    lazy(async () => byMethod(await import("./routes/rooms/[code]/again.ts"))),
  ),
);
