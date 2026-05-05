import "server-only";
import { jsonError } from "@/lib/api";
import {
  isOpenRouterConfigured,
  streamChatCompletion,
  type ChatMessage,
  type ToolCall,
} from "@/lib/llm/openrouter";
import {
  ADMIN_TOOLS,
  adminSystemPrompt,
  runAdminTool,
  type AdminWidget,
} from "@/lib/llm/admin-tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin assistant streaming endpoint. Same shape as /api/chat-booking
// but with the admin tool surface. Auth is enforced by middleware
// (Supabase cookie session + email allowlist) — this handler trusts
// that and never reaches it for non-admin callers.

const MAX_HISTORY = 30;
const MAX_INPUT_LEN = 2000;
const MAX_TOOL_TURNS = 6;

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  if (!isOpenRouterConfigured()) return jsonError("chat_not_configured", 503);

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

  const conversation: ChatMessage[] = [
    { role: "system", content: adminSystemPrompt() },
    ...trimmed,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };

      try {
        for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
          let assistantText = "";
          const toolCalls: ToolCall[] = [];
          let finishReason: string | null = null;

          for await (const event of streamChatCompletion({
            messages: conversation,
            tools: ADMIN_TOOLS,
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

          if (toolCalls.length === 0) break;

          conversation.push({
            role: "assistant",
            content: assistantText || null,
            tool_calls: toolCalls,
          });

          for (const tc of toolCalls) {
            const result = await runAdminTool(tc.function.name, tc.function.arguments);
            if (result.widget) {
              send({ type: "widget", widget: result.widget as AdminWidget });
            }
            conversation.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result.text,
            });
          }

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
