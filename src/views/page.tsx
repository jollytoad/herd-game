import type { Children } from "@http/jsx-stream/types";
import { GAME_NAME } from "../brand.ts";

export function Page(
  props: { title: string; sseCode?: string; children?: Children },
) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title}</title>
        <link rel="stylesheet" href="/style.css" />
        {
          /* Loaded on every page (not just rooms): boosted landing/join forms
            navigate into the room page without a full reload, so htmx + the
            SSE extension must already be present in the original head. */
        }
        <script
          src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0/dist/htmx.min.js"
          defer
        />
        <script
          src="https://cdn.jsdelivr.net/npm/htmx.org@4.0.0/dist/ext/hx-sse.min.js"
          defer
        />
      </head>
      <body>
        <header>
          🐮 {GAME_NAME}
          {props.sseCode
            ? (
              <span>
                · room <b>{props.sseCode}</b>
              </span>
            )
            : null}
        </header>
        <main>{props.children}</main>
      </body>
    </html>
  );
}
