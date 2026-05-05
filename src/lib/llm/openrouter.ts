import "server-only";

// Minimal OpenRouter client. OpenRouter is an aggregator that exposes
// every model behind a single OpenAI-compatible endpoint, which lets us
// pick the model by string slug (e.g. "anthropic/claude-3.5-sonnet")
// without juggling per-vendor SDKs. We use raw fetch + their Streaming
// Server-Sent Events response so we can interleave model output with
// our own widget events on the way to the browser.
//
// Required env vars:
//   OPENROUTER_API_KEY — sk-or-... key from https://openrouter.ai/keys.
//                        Without it, both chat surfaces return 503.
//
// Optional env vars:
//   OPENROUTER_MODEL   — model slug. Defaults to a strong tool-calling
//                        Claude variant; can be overridden in env to
//                        swap quality / cost without redeploy.

// OpenRouter slugs change as new Anthropic versions ship — pin to a
// concrete current Sonnet so model-not-found doesn't silently break
// the chat. Override via OPENROUTER_MODEL env var when bumping.
const DEFAULT_MODEL = "anthropic/claude-4.6-sonnet-20260217";

export type Role = "system" | "user" | "assistant" | "tool";

export type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; id: string; name: string; argsDelta: string }
  | { type: "tool_call_done"; id: string; name: string; args: string }
  | { type: "done"; finishReason: string | null };

export function isOpenRouterConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

// Streams a single completion turn from OpenRouter. Yields normalized
// events the caller can route to text-rendering or tool-execution paths
// without parsing OpenAI deltas inline.
export async function* streamChatCompletion(input: {
  messages: ChatMessage[];
  tools?: ToolDef[];
  temperature?: number;
}): AsyncGenerator<StreamEvent, void, void> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("openrouter_not_configured");

  const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Site identification headers are recommended by OpenRouter so
      // your usage shows up correctly on their dashboard.
      "HTTP-Referer":
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://sport-booking-pi.vercel.app",
      "X-Title": "Smash Courts Kuwait",
    },
    body: JSON.stringify({
      model,
      messages: input.messages,
      tools: input.tools,
      tool_choice: input.tools && input.tools.length > 0 ? "auto" : undefined,
      temperature: input.temperature ?? 0.4,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`openrouter_${res.status}: ${text.slice(0, 500)}`);
  }

  // Per-tool-call accumulators so we can emit a single tool_call_done
  // event with the complete JSON arguments string once a tool call is
  // fully assembled. Tool calls stream as a sequence of partial argument
  // chunks; the model also retroactively names them on the first chunk.
  const toolAcc = new Map<
    number,
    { id: string; name: string; args: string }
  >();
  let finishReason: string | null = null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;

      let json: {
        choices?: Array<{
          delta?: {
            content?: string | null;
            tool_calls?: Array<{
              index?: number;
              id?: string;
              function?: { name?: string; arguments?: string };
            }>;
          };
          finish_reason?: string | null;
        }>;
      };
      try {
        json = JSON.parse(payload);
      } catch {
        continue;
      }

      const choice = json.choices?.[0];
      if (!choice) continue;

      const text = choice.delta?.content;
      if (typeof text === "string" && text.length > 0) {
        yield { type: "text", delta: text };
      }

      const toolCalls = choice.delta?.tool_calls;
      if (toolCalls) {
        for (const tc of toolCalls) {
          const idx = tc.index ?? 0;
          const existing = toolAcc.get(idx) ?? { id: "", name: "", args: "" };
          if (tc.id) existing.id = tc.id;
          if (tc.function?.name) existing.name = tc.function.name;
          if (tc.function?.arguments)
            existing.args += tc.function.arguments;
          toolAcc.set(idx, existing);
          if (tc.function?.arguments) {
            yield {
              type: "tool_call",
              id: existing.id,
              name: existing.name,
              argsDelta: tc.function.arguments,
            };
          }
        }
      }

      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  for (const tc of toolAcc.values()) {
    yield { type: "tool_call_done", id: tc.id, name: tc.name, args: tc.args };
  }
  yield { type: "done", finishReason };
}
