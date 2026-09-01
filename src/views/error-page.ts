import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { doc } from "./doc.ts";

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
