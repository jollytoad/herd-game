/** Minimal OpenAI-compatible chat client. Configured via standard env vars:
 *  OPENAI_BASE_URL (default https://api.openai.com/v1), OPENAI_API_KEY, LLM_MODEL.
 *  When no key is set, the whole game runs in mock mode (see judge.ts). */

export type Msg = { role: "system" | "user" | "assistant"; content: string };

const BASE_URL = (Deno.env.get("OPENAI_BASE_URL") ?? "https://api.openai.com/v1").replace(
  /\/+$/,
  "",
);
const API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

export const LLM_MODEL = Deno.env.get("LLM_MODEL") ?? "gpt-4o-mini";
export const llmEnabled = API_KEY.length > 0;

const TIMEOUT_MS = 45_000;

export async function chat(
  messages: Msg[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: LLM_MODEL,
      messages,
      temperature: opts.temperature ?? 0.8,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`LLM request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const content: unknown = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("LLM returned an empty response");
  }
  return content;
}

/** Best-effort JSON extraction from an LLM response (handles ``` fences, prose padding). */
export function parseJsonLoose(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw new Error("no JSON object found in response");
  }
}
