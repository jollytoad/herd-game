import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";

export function post(code: string, action: string, extra = ""): HtmlNode {
  // outerMorph (not outerHTML) keeps the #board DOM node identical — the
  // hx-sse connection holds that node as its swap target, and replacing it
  // would orphan the live SSE stream until the next full page load.
  return html`hx-post="/rooms/${code}/${action}" hx-target="#board" hx-swap="outerMorph"${extra}`;
}
