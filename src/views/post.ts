/** Props for an htmx action that posts into #board. Spread into a JSX element:
 *  `<form {...postProps(code, "answer")} />`.
 *
 *  outerMorph (not outerHTML) keeps the #board DOM node identical — the
 *  hx-sse connection holds that node as its swap target, and replacing it
 *  would orphan the live SSE stream until the next full page load. */
export function postProps(
  code: string,
  action: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    "hx-post": `/rooms/${code}/${action}`,
    "hx-target": "#board",
    "hx-swap": "outerMorph",
    ...extra,
  };
}
