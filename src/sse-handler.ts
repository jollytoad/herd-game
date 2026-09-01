import type { HtmlNode } from "@http/html-stream/types";
import { renderString } from "@http/token-stream/render-string";
import { getCookies } from "@std/http/cookie";
import { tickRoom } from "./game.ts";
import { getRoom } from "./rooms.ts";
import { Board } from "./views/board-html.tsx";

// ---------------------------------------------------------------------------
// SSE: streams a fresh #board fragment whenever the room version changes
// (every 1s during the asking phase, so the countdown stays live)
// ---------------------------------------------------------------------------
export function sseHandler(req: Request, code: string): Response {
  const { token } = getCookies(req.headers);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastVersion = -1;
      const send = async (html: HtmlNode) => {
        // Unnamed events auto-swap via the hx-sse extension's hx-target/hx-swap.
        controller.enqueue(
          encoder.encode(`data: ${(await renderString(html)).replace(/\s*\n\s*/g, " ")}\n\n`),
        );
      };
      try {
        // Loop until the room dies or the client disconnects (a disconnect makes
        // the next enqueue() throw). We deliberately do not use req.signal:
        // Deno's legacy behavior aborts it as soon as the streaming Response is
        // returned, which would kill the stream immediately.
        while (true) {
          await tickRoom(code); // lazy timers + bot turns
          const room = await getRoom(code);
          if (!room) break;
          const player = token ? room.players.find((p) => p.token === token) : undefined;
          if (!player) break; // not a member of this room
          if (room.version !== lastVersion || room.phase === "asking") {
            await send(Board({ room, player }));
            lastVersion = room.version;
          } else {
            controller.enqueue(encoder.encode(": ping\n\n"));
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
      } catch {
        // client disconnected or stream errored; EventSource reconnects
      }
      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}
