/** Server-rendered HTML. Pure template literals, no framework.
 *  One file per template function under `src/views/`; this barrel re-exports
 *  the public entry points. `boardHtml(...)` is swapped into #board by htmx
 *  (action POSTs) and by a tiny EventSource listener (SSE "board" events). */

export { boardHtml } from "./views/board-html.ts";
export { errorPage } from "./views/error-page.ts";
export { joinPage } from "./views/join-page.ts";
export { landingPage } from "./views/landing-page.ts";
export { roomPage } from "./views/room-page.ts";
