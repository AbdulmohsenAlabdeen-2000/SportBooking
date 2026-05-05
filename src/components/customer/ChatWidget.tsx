"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X, Sparkles } from "lucide-react";
import { useDict } from "@/lib/i18n/client";

type Message = { role: "user" | "assistant"; content: string };

// Floating chat support widget for the customer area. Talks to /api/chat
// which streams Claude's response back as plain text. State is in-memory
// only — closing the widget keeps the conversation; a hard refresh resets.

export function ChatWidget() {
  const t = useDict();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: t.chat.greeting }]);
    }
  }, [open, messages.length, t.chat.greeting]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const next: Message[] = [
      ...messages,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Strip the seed greeting before sending — that's UI-only.
        body: JSON.stringify({
          messages: next
            .slice(0, -1)
            .filter(
              (m, i) =>
                !(
                  i === 0 &&
                  m.role === "assistant" &&
                  m.content === t.chat.greeting
                ),
            ),
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: t.chat.error,
          };
          return copy;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: t.chat.error,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.chat.open_aria}
          className="fixed bottom-5 end-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-4 ring-brand/20 transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
        >
          <MessageCircle className="h-6 w-6" aria-hidden />
        </button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-40 sm:inset-x-auto sm:bottom-5 sm:end-5 sm:w-[380px]">
          <div className="flex max-h-[80vh] flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[600px] sm:rounded-2xl">
            <header className="flex items-center justify-between gap-2 rounded-t-2xl bg-brand px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold leading-tight">
                    {t.chat.title}
                  </p>
                  <p className="text-[11px] text-white/80">{t.chat.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t.chat.close_aria}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>

            <div
              ref={scrollRef}
              className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-3 py-3"
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      m.role === "user"
                        ? "max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-white"
                        : "max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    }
                  >
                    {m.content || (
                      <span className="inline-flex gap-1 text-slate-400">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
              className="flex items-end gap-2 rounded-b-2xl border-t border-slate-200 bg-white px-3 py-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                maxLength={2000}
                placeholder={t.chat.placeholder}
                className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
                disabled={streaming}
              />
              <button
                type="submit"
                disabled={streaming || input.trim().length === 0}
                aria-label={t.chat.send_aria}
                className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-brand text-white transition-opacity hover:bg-brand-dark disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
