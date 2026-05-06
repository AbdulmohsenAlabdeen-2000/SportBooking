"use client";

import { Sparkles } from "lucide-react";
import { OPEN_EVENT } from "@/components/chat-booking/SidePanelChatBooking";

// Hero "Book by chat" button. Lives as a tiny client component so it
// can dispatch the open-chat event without dragging the whole Hero
// into the client bundle.

export function HeroChatCTA({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-6 py-4 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/15"
    >
      <Sparkles
        className="h-4 w-4 text-amber-300 transition-transform group-hover:rotate-12 motion-reduce:transform-none"
        aria-hidden
      />
      {label}
    </button>
  );
}
