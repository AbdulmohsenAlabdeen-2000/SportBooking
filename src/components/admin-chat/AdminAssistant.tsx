"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import {
  TodaySummary,
  TotalRevenue,
  WeekChart,
  BookingListW,
  BookingDetail,
  CompletedConfirmation,
} from "./AdminWidgets";
import type { AdminChatWidget } from "./widgets";

type Message =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      widgets?: AdminChatWidget[];
      streaming?: boolean;
    };

type ServerEvent =
  | { type: "text"; delta: string }
  | { type: "widget"; widget: AdminChatWidget }
  | { type: "done" }
  | { type: "error"; message: string };

// Suggested starter prompts admins can click instead of typing.
const SUGGESTIONS: string[] = [
  "What's today's revenue?",
  "Show me bookings for today",
  "Show me cancellations this week",
  "Look up BK-2026-",
];

export function AdminAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hi Ahmed. Ask me about today's stats, look up a booking by reference, or pull recent bookings. I can also mark confirmed bookings as completed.",
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, busy]);

  async function ask(prompt: string) {
    if (!prompt.trim() || busy) return;
    const userMsg: Message = { role: "user", content: prompt };
    const next: Message[] = [
      ...messages,
      userMsg,
      { role: "assistant", content: "", streaming: true },
    ];
    setMessages(next);
    setInput("");
    setBusy(true);

    const wireHistory = next
      .slice(0, -1)
      .filter((m, i) => !(i === 0 && m.role === "assistant"))
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/admin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wireHistory }),
      });
      if (!res.ok || !res.body) {
        appendError();
        return;
      }
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
          if (!line) continue;
          let evt: ServerEvent;
          try {
            evt = JSON.parse(line) as ServerEvent;
          } catch {
            continue;
          }
          applyEvent(evt);
        }
      }
    } catch {
      appendError();
    } finally {
      setBusy(false);
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = { ...last, streaming: false };
        }
        return copy;
      });
    }
  }

  function applyEvent(evt: ServerEvent) {
    if (evt.type === "text") {
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          copy[copy.length - 1] = {
            ...last,
            content: last.content + evt.delta,
          };
        }
        return copy;
      });
    } else if (evt.type === "widget") {
      // Admin assistant can stack multiple widgets in one turn (e.g.
      // today_summary + week_chart). Append rather than replacing.
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          const widgets = [...(last.widgets ?? []), evt.widget];
          copy[copy.length - 1] = { ...last, widgets };
        }
        return copy;
      });
    } else if (evt.type === "error") {
      appendError();
    }
  }

  function appendError() {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      const errText = "Sorry, something went wrong. Please try again.";
      if (last && last.role === "assistant" && last.streaming) {
        copy[copy.length - 1] = {
          role: "assistant",
          content: errText,
          streaming: false,
        };
      } else {
        copy.push({ role: "assistant", content: errText });
      }
      return copy;
    });
  }

  return (
    <div className="-m-4 flex h-[calc(100vh-8rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm md:-m-6">
      <header className="flex items-center justify-between gap-2 rounded-t-2xl border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">
              Admin assistant
            </p>
            <p className="text-[11px] text-white/70">
              Read-mostly. Money-moving actions still go through the dashboard.
            </p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 px-3 py-4">
        <ul className="mx-auto flex max-w-3xl flex-col gap-3">
          {messages.map((m, i) => (
            <li
              key={i}
              className={
                m.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-slate-800 px-3.5 py-2 text-sm text-white shadow-sm">
                  {m.content}
                </div>
              ) : (
                <div className="flex max-w-full flex-col gap-2">
                  {m.content || m.streaming ? (
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 shadow-sm">
                      {m.content || (
                        <span className="inline-flex gap-1 text-slate-400">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                        </span>
                      )}
                    </div>
                  ) : null}
                  {m.widgets?.map((w, wi) => (
                    <div key={wi} className="max-w-full">
                      {w.type === "today_summary" && <TodaySummary widget={w} />}
                      {w.type === "total_revenue" && <TotalRevenue widget={w} />}
                      {w.type === "week_chart" && <WeekChart widget={w} />}
                      {w.type === "booking_list" && <BookingListW widget={w} />}
                      {w.type === "booking_detail" && <BookingDetail widget={w} />}
                      {w.type === "completed_confirmation" && (
                        <CompletedConfirmation widget={w} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {messages.length <= 1 ? (
        <div className="border-t border-slate-100 bg-white px-3 py-2">
          <div className="mx-auto flex max-w-3xl flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                disabled={busy}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="rounded-b-2xl border-t border-slate-200 bg-white px-3 py-3"
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="Ask anything about your bookings…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-slate-800 text-white shadow transition-colors hover:bg-slate-700 disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Send className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
