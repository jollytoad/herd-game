/** Minimal Ollama Cloud chat client. Configured via standard env vars:
 *  OLLAMA_BASE_URL (default https://ollama.com), OLLAMA_API_KEY, LLM_MODEL.
 *  When no key is set, the whole game runs in mock mode (see judge.ts).
 *
 *  Spec: https://docs.ollama.com/api/chat */

export type Msg = { role: "system" | "user" | "assistant"; content: string };

const BASE_URL = (Deno.env.get("OLLAMA_BASE_URL") ?? "https://ollama.com").replace(/\/+$/, "");
const API_KEY = Deno.env.get("OLLAMA_API_KEY") ?? "";

export const LLM_MODEL = Deno.env.get("LLM_MODEL") ?? "gpt-oss:120b";
export const llmEnabled = API_KEY.length > 0;

const TIMEOUT_MS = 45_000;

import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("herd-intelligence.llm");

export function chat(
  messages: Msg[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  return tracer.startActiveSpan(
    "llm.chat",
    { attributes: { "llm.model": LLM_MODEL } },
    async (span) => {
      try {
        const text = await doChat(messages, opts);
        span.setAttribute("llm.response.chars", text.length);
        return text;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

async function doChat(
  messages: Msg[],
  opts: { json?: boolean; temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  // Note: no `think` field — models use their default. (glm-5.3-flash thinks
  // by default; forcing think:false makes it leak reasoning into content.)
  const body: Record<string, unknown> = {
    model: LLM_MODEL,
    messages,
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.8,
      ...(opts.maxTokens ? { num_predict: opts.maxTokens } : {}),
    },
  };
  if (opts.json) body.format = "json";

  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(API_KEY ? { authorization: `Bearer ${API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`LLM request failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const content: unknown = data?.message?.content;
  // num_predict caps thinking + content combined, so thinking models can run
  // out of budget mid-answer (done_reason "length") — surface that clearly.
  if (data?.done_reason === "length") {
    throw new Error("LLM output truncated (num_predict too small)");
  }
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
