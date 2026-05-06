"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Sparkles } from "lucide-react";
import { CourtPicker } from "./CourtPickerWidget";
import { DatePicker } from "./DatePickerWidget";
import { SlotPicker } from "./SlotPickerWidget";
import { ConfirmBooking } from "./ConfirmBookingWidget";
import { CLOSE_EVENT } from "./SidePanelChatBooking";
import { useDict } from "@/lib/i18n/client";
import type { ChatWidget } from "./widgets";

// Conversational booking surface. Renders a vertical thread of
// alternating user / assistant messages; each assistant message can
// carry a rich widget that the user interacts with directly. Picking a
// court / date / slot in a widget posts a synthetic user message ("I'll
// pick X") which the model treats as a normal turn.
//
// The "Confirm and pay" button on the final widget redirects to the
// existing booking-details page with slot+date prefilled — that page
// already has the validated form + payment redirect. We deliberately
// don't reimplement that flow in chat.

type Message =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      widget?: ChatWidget;
      streaming?: boolean;
    };

type ServerEvent =
  | { type: "text"; delta: string }
  | { type: "widget"; widget: ChatWidget }
  | { type: "done" }
  | { type: "error"; message: string };

export function ChatBooking() {
  const router = useRouter();
  const t = useDict();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Seed greeting on first mount.
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            t.chat_booking?.greeting ??
            "Hi! I can help you book a court. Tell me what sport you'd like to play, or say 'show me what's available'.",
        },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll on every message tick.
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
    const next = [...messages, userMsg, {
      role: "assistant" as const,
      content: "",
      streaming: true,
    }];
    setMessages(next);
    setInput("");
    setBusy(true);

    // Strip the seed greeting before sending — it's UI-only.
    const wireHistory = next
      .slice(0, -1)
      .filter((m, i) => !(i === 0 && m.role === "assistant"))
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat-booking", {
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
      // Attach the widget to the latest assistant message. If a widget
      // was already there (rare but possible if model called multiple
      // tools in one turn), spawn a fresh assistant bubble for clarity.
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant" && !last.widget) {
          copy[copy.length - 1] = { ...last, widget: evt.widget };
          return copy;
        }
        return [
          ...copy,
          { role: "assistant", content: "", widget: evt.widget },
        ];
      });
    } else if (evt.type === "error") {
      appendError(evt.message);
    }
  }

  function appendError(detail?: string) {
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      const baseText =
        t.chat_booking?.error ??
        "Sorry, something went wrong. Please try again.";
      // Surface the upstream reason so issues like "model not found" or
      // "missing API key" show up in the UI instead of being silent.
      const errText = detail ? `${baseText}\n\n(${detail})` : baseText;
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

  // Widget interaction handlers — each posts a synthetic user message
  // back into the conversation. We include UUIDs so the model can pass
  // them to the next tool without re-deriving them; sending only the
  // human label (e.g. court name) breaks the chain because the model
  // doesn't have the UUID in any earlier message.
  function pickCourt(id: string, name: string) {
    void ask(`Selected court: ${name} (court_id=${id}). Show me available dates.`);
  }
  function pickDate(date: string) {
    void ask(`Selected date: ${date}. Show me the open time slots.`);
  }
  function pickSlot(slotId: string) {
    void ask(`Selected slot (slot_id=${slotId}). Prepare the booking.`);
  }
  function confirmBooking(courtId: string, slotId: string, startIso: string) {
    setConfirmBusy(true);
    const date = startIso.slice(0, 10);
    router.push(
      `/book/${courtId}/details?slot=${encodeURIComponent(slotId)}&date=${encodeURIComponent(date)}`,
    );
    // Slide the panel out so the booking-details form behind it is
    // visible. The router.push only changes the URL — the side panel
    // is mounted in the customer layout and stays open by default.
    window.dispatchEvent(new Event(CLOSE_EVENT));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-gradient-to-r from-brand to-brand-dark px-4 py-3 pe-14 text-white shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">
              {t.chat_booking?.title ?? "Book by chat"}
            </p>
            <p className="text-[11px] text-white/80">
              {t.chat_booking?.subtitle ??
                "Tell me what you want to play and when. I'll handle the rest."}
            </p>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-slate-50 px-3 py-4"
      >
        <ul className="mx-auto flex max-w-2xl flex-col gap-3">
          {messages.map((m, i) => (
            <li
              key={i}
              className={
                m.role === "user" ? "flex justify-end" : "flex justify-start"
              }
            >
              {m.role === "user" ? (
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-brand px-3.5 py-2 text-sm text-white shadow-sm">
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
                  {m.widget ? (
                    <div className="max-w-full">
                      {m.widget.type === "court_picker" && (
                        <CourtPicker
                          widget={m.widget}
                          onPick={pickCourt}
                          disabled={busy}
                        />
                      )}
                      {m.widget.type === "date_picker" && (
                        <DatePicker
                          widget={m.widget}
                          onPick={pickDate}
                          disabled={busy}
                        />
                      )}
                      {m.widget.type === "slot_picker" && (
                        <SlotPicker
                          widget={m.widget}
                          onPick={pickSlot}
                          disabled={busy}
                        />
                      )}
                      {m.widget.type === "confirm_booking" && (
                        <ConfirmBooking
                          widget={m.widget}
                          busy={confirmBusy}
                          disabled={busy}
                          onConfirm={() =>
                            m.widget?.type === "confirm_booking"
                              ? confirmBooking(
                                  m.widget.court_id,
                                  m.widget.slot_id,
                                  m.widget.start_time,
                                )
                              : null
                          }
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
        className="border-t border-slate-200 bg-white px-3 py-3"
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
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
            placeholder={
              t.chat_booking?.placeholder ??
              "What do you want to play? (e.g. 'padel tomorrow at 7pm')"
            }
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand focus:bg-white focus:outline-none"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand text-white shadow transition-colors hover:bg-brand-dark disabled:opacity-40"
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
