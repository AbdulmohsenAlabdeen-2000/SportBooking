import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { getClientIp, isLoopback, rateLimit } from "@/lib/ratelimit";
import {
  isOpenRouterConfigured,
  streamChatCompletion,
  type ChatMessage,
  type ToolCall,
} from "@/lib/llm/openrouter";
import {
  CUSTOMER_TOOLS,
  customerSystemPrompt,
  runCustomerTool,
  type WidgetPayload,
} from "@/lib/llm/customer-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Conversational booking endpoint. The customer sends prior conversation
// history; we run the OpenRouter completion loop server-side, calling
// our internal tools when the model asks, and stream a normalized JSON
// event stream back to the browser. The browser doesn't see any LLM
// vendor format — only our `{type: "text" | "widget" | "done", ...}`
// events that map to UI primitives.
//
// Auth: anonymous-friendly. The user can chat without an account; the
// confirm widget eventually drives the existing /api/bookings POST flow
// which has its own validation + payment flow + ownership semantics.

const MAX_HISTORY = 30;
const MAX_INPUT_LEN = 2000;
const MAX_TOOL_TURNS = 6;

const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 5 * 60_000;

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  if (!isOpenRouterConfigured()) {
    return jsonError("chat_not_configured", 503);
  }

  const ip = getClientIp(req);
  if (!isLoopback(ip)) {
    const rl = rateLimit(
      `POST:/api/chat-booking:${ip}`,
      RATE_LIMIT,
      RATE_WINDOW_MS,
    );
    if (!rl.ok) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
        },
      });
    }
  }

  let body: { messages?: unknown };
  try {
    body = (await req.json()) as { messages?: unknown };
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (!Array.isArray(body.messages)) return jsonError("invalid_messages", 400);

  const incoming: IncomingMessage[] = [];
  for (const m of body.messages) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim().length > 0
    ) {
      incoming.push({ role, content: content.slice(0, MAX_INPUT_LEN) });
    }
  }
  if (incoming.length === 0 || incoming[incoming.length - 1].role !== "user") {
    return jsonError("invalid_messages", 400);
  }

  const trimmed = incoming.slice(-MAX_HISTORY);

  // Pull a short hint of currently-active courts so the system prompt
  // can ground the model in real names without forcing a tool call for
  // trivial questions.
  const supabase = createServerClient();
  const { data: courts } = await supabase
    .from("courts")
    .select("name, sport")
    .eq("is_active", true)
    .order("name");
  const hint = (courts ?? [])
    .map((c) => `- ${c.name} (${c.sport})`)
    .join("\n");

  const conversation: ChatMessage[] = [
    { role: "system", content: customerSystemPrompt(hint) },
    ...trimmed,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };

      try {
        // Tool-call loop. Each turn runs one streaming completion. If
        // it ends with tool_calls, execute them server-side, append the
        // assistant + tool results to the conversation, then loop.
        // Otherwise the model produced a final user-facing message and
        // we're done.
        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
          let assistantText = "";
          const toolCalls: ToolCall[] = [];
          let finishReason: string | null = null;

          for await (const event of streamChatCompletion({
            messages: conversation,
            tools: CUSTOMER_TOOLS,
          })) {
            if (event.type === "text") {
              assistantText += event.delta;
              send({ type: "text", delta: event.delta });
            } else if (event.type === "tool_call_done") {
              toolCalls.push({
                id: event.id,
                type: "function",
                function: { name: event.name, arguments: event.args },
              });
            } else if (event.type === "done") {
              finishReason = event.finishReason;
            }
          }

          if (toolCalls.length === 0) {
            // No tools — the model's text was its final answer.
            break;
          }

          // Append the assistant turn that requested the tool calls.
          conversation.push({
            role: "assistant",
            content: assistantText || null,
            tool_calls: toolCalls,
          });

          // Run each tool, stream a widget event for the client, and
          // feed the textual result back to the model.
          for (const tc of toolCalls) {
            const result = await runCustomerTool(tc.function.name, tc.function.arguments);
            if (result.widget) {
              send({ type: "widget", widget: result.widget as WidgetPayload });
            }
            conversation.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result.text,
            });
          }

          // Defensive: if the model claimed it was done but still emitted tools,
          // honor the tool execution and continue. If it explicitly stopped with
          // a non-"tool_calls" reason after tool calls, that's a finished turn.
          if (finishReason && finishReason !== "tool_calls") break;
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream_error";
        send({ type: "error", message: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
