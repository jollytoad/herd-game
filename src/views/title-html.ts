/** Title with the last word in the accent colour: Herd <pink>Intelligence</pink>. */

import { GAME_NAME } from "../brand.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";

export function titleHtml(): HtmlNode {
  const words = GAME_NAME.split(" ");
  const last = words.pop() ?? "";
  return html`${words.join(" ")} <span class="pink">${last}</span>`;
}
