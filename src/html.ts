import { renderHtmlBody } from "@http/html-stream/render-html-body";
import type { HtmlNode } from "@http/html-stream/types";

// ---------------------------------------------------------------------------
// Http helpers (mirrored from handler.ts — this module will replace it)
// ---------------------------------------------------------------------------
export function html(body: HtmlNode, status = 200): Response {
  return new Response(renderHtmlBody(body), {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
