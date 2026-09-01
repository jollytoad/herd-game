import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";

export function judging(): HtmlNode {
  return html`
    <div class="spinner"></div>
    <p class="muted">The herd is deliberating… the LLM referee is comparing notes.</p>
  `;
}
