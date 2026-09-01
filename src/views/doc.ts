import { GAME_NAME } from "../brand.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";

export function doc(
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
