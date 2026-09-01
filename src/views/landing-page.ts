import { GAME_NAME, TAGLINE } from "../brand.ts";
import { html } from "@http/html-stream/template";
import type { HtmlNode } from "@http/html-stream/types";
import { doc } from "./doc.ts";
import { titleHtml } from "./title-html.ts";

export function landingPage(): HtmlNode {
  return doc(
    GAME_NAME,
    html`
      <h1>🐮 ${titleHtml()}</h1>
      <p class="tag">${TAGLINE}</p>
      <div class="cards">
        <form class="card" method="post" action="/rooms">
          <h2>Create a room</h2>
          <input type="text" name="name" placeholder="Your name" required maxlength="24"
            autocomplete="off">
          <button class="btn primary">Create room</button>
        </form>
        <form class="card" method="post" action="/rooms/join">
          <h2>Join a room</h2>
          <input type="text" name="code" placeholder="ROOM CODE" required maxlength="4" minlength="4"
            style="text-transform:uppercase;letter-spacing:0.3em;text-align:center" autocomplete="off">
          <input type="text" name="name" placeholder="Your name" required maxlength="24"
            autocomplete="off">
          <button class="btn primary">Join</button>
        </form>
      </div>
      <div class="rules-blurb">
        Each round everyone secretly answers the same prompt. The LLM referee finds the
        <b>herd answer</b> — the most common one, synonyms included. Match the herd and you
        score a cow. Miss it and you're stuck holding the <b>pink cow</b> 🐷 until you match
        the herd again. First to 8 cows <i>without</i> the pink cow wins.
      </div>
    `,
  );
}
