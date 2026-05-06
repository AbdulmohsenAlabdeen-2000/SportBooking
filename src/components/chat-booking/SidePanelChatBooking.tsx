"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { ChatBooking } from "./ChatBooking";
import { useDict } from "@/lib/i18n/client";

// Floating button (bottom-right) + slide-in side panel (right edge)
// containing the conversational booking experience. The panel listens
// for a `smash:open-chat-booking` window event so other surfaces (e.g.
// the landing Hero CTA) can open it without prop-drilling. Pressing
// Escape, clicking the backdrop, or hitting the close button all
// dismiss the panel.
//
// On mobile the panel takes the full viewport; on desktop it's a
// 480px-wide drawer with a dimmed backdrop behind it.

export const OPEN_EVENT = "smash:open-chat-booking";

export function SidePanelChatBooking() {
  const t = useDict();
  const [open, setOpen] = useState(false);

  // Listen for the global open event from anywhere on the page.
  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Esc-to-close + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/* Launcher — only renders when panel is closed so it doesn't
          float on top of itself. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.chat_booking?.open_aria ?? "Open booking chat"}
          className="group fixed bottom-5 end-5 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand to-brand-dark px-4 py-3 text-sm font-semibold text-white shadow-lg ring-4 ring-brand/15 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/30 active:translate-y-0 active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          <Sparkles
            className="h-4 w-4 text-amber-300 transition-transform group-hover:rotate-12 motion-reduce:transform-none"
            aria-hidden
          />
          <span className="hidden sm:inline">
            {t.chat_booking?.launcher_label ?? "Book by chat"}
          </span>
        </button>
      )}

      {/* Backdrop — fade in/out. Always mounted so the transition runs;
          pointer-events flips with `open` so clicks pass through when
          closed. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={[
          "fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      {/* Panel — fixed to the right edge, slides in via translate. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t.chat_booking?.title ?? "Book by chat"}
        className={[
          "fixed inset-y-0 end-0 z-50 flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none sm:w-[480px]",
          open ? "translate-x-0 rtl:-translate-x-0" : "translate-x-full rtl:-translate-x-full",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t.chat_booking?.close_aria ?? "Close booking chat"}
          className="absolute end-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        {/* The chat itself fills the rest. We only mount the chat when
            the panel has ever been opened so it doesn't make pre-fetch
            requests on every customer page render. */}
        {open ? <ChatBooking /> : null}
      </aside>
    </>
  );
}
