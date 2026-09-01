import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { doc } from "./doc.ts";

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
