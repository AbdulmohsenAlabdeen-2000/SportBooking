import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { kuwaitDateToUtcRange, kuwaitTodayIso, nextNDaysIso, BOOKING_WINDOW_DAYS } from "@/lib/time";
import type { ToolDef } from "@/lib/llm/openrouter";
import type { Sport } from "@/lib/types";

// Tools the model can call from the customer chat. Each entry has:
//   - schema:   the OpenAI function-calling JSON schema sent to the model
//   - run:      server-side dispatcher that returns text-for-the-model AND
//               an optional widget the frontend should render inline
//
// Widgets: tools that the model is "showing" the user (court list, slot
// grid, confirmation card) emit a widget payload. The model still gets
// a textual summary so its next turn can talk about the data.
//
// We deliberately keep this layer small and predictable. The model is
// not given a "create booking" tool — confirmation must go through the
// existing /api/bookings POST flow which handles payment, rate limits,
// validation, ownership. The chat just queues the booking parameters.

export type WidgetPayload =
  | {
      type: "court_picker";
      courts: Array<{
        id: string;
        name: string;
        sport: Sport;
        capacity: number;
        price_per_slot: number;
        image_url: string | null;
        is_popular?: boolean;
        is_new?: boolean;
      }>;
    }
  | {
      type: "date_picker";
      court_id: string;
      court_name: string;
      sport: Sport;
      days: Array<{ date: string; open_count: number }>;
    }
  | {
      type: "slot_picker";
      court_id: string;
      court_name: string;
      sport: Sport;
      date: string;
      slots: Array<{
        id: string;
        start_time: string;
        end_time: string;
        status: "open" | "booked" | "closed";
        is_past: boolean;
      }>;
    }
  | {
      type: "confirm_booking";
      court_id: string;
      court_name: string;
      sport: Sport;
      slot_id: string;
      start_time: string;
      end_time: string;
      price: number;
    };

export type ToolResult = {
  text: string; // What the model sees as the tool's output
  widget?: WidgetPayload; // What the UI renders to the user
};

export const CUSTOMER_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "list_courts",
      description:
        "Show the customer the list of courts they can book. Use this when they ask to see options, when they want to know what's available, or to start a fresh booking.",
      parameters: {
        type: "object",
        properties: {
          sport: {
            type: "string",
            description:
              "Optional sport filter. One of: padel, tennis, football, squash, basketball, volleyball, cricket, pickleball, badminton, futsal.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_dates",
      description:
        "Show the customer which days have open slots for a court they've picked. Returns the next 14 days with open-slot counts. Call this after the customer has chosen a specific court.",
      parameters: {
        type: "object",
        properties: {
          court_id: {
            type: "string",
            description: "UUID of the court the customer picked.",
          },
        },
        required: ["court_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_slots",
      description:
        "Show the customer the time slots for a specific court on a specific date. Past slots and already-booked slots are surfaced as unavailable.",
      parameters: {
        type: "object",
        properties: {
          court_id: {
            type: "string",
            description: "UUID of the court.",
          },
          date: {
            type: "string",
            description: "Kuwait date in YYYY-MM-DD format.",
          },
        },
        required: ["court_id", "date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_booking",
      description:
        "Display a final confirmation card to the customer summarising the court, date, time, and price. This does NOT actually create the booking — the customer reviews and clicks 'Confirm and pay' which kicks off the payment flow. Call this once they've picked both a court AND a slot.",
      parameters: {
        type: "object",
        properties: {
          court_id: { type: "string" },
          slot_id: { type: "string" },
        },
        required: ["court_id", "slot_id"],
      },
    },
  },
];

export async function runCustomerTool(
  name: string,
  rawArgs: string,
): Promise<ToolResult> {
  let args: Record<string, unknown>;
  try {
    args = rawArgs.trim() ? JSON.parse(rawArgs) : {};
  } catch {
    return { text: `Error: tool arguments were not valid JSON: ${rawArgs}` };
  }

  switch (name) {
    case "list_courts":
      return await runListCourts(args);
    case "list_dates":
      return await runListDates(args);
    case "list_slots":
      return await runListSlots(args);
    case "prepare_booking":
      return await runPrepareBooking(args);
    default:
      return { text: `Error: unknown tool "${name}".` };
  }
}

async function runListCourts(args: Record<string, unknown>): Promise<ToolResult> {
  const sport = typeof args.sport === "string" ? args.sport.toLowerCase() : null;
  const supabase = createServerClient();
  let q = supabase
    .from("courts")
    .select(
      "id, name, sport, capacity, price_per_slot, image_url, created_at",
    )
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (sport) q = q.eq("sport", sport);
  const { data, error } = await q;
  if (error) return { text: `Error fetching courts: ${error.message}` };
  const courts = data ?? [];

  // Quick popularity calc — same window logic as /api/courts.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("court_id, status")
    .gte("created_at", since)
    .in("status", ["confirmed", "completed"]);
  const counts = new Map<string, number>();
  for (const b of bookingRows ?? []) {
    const id = (b as { court_id: string | null }).court_id;
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const newCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const widget = {
    type: "court_picker" as const,
    courts: courts.map((c) => ({
      id: c.id,
      name: c.name,
      sport: c.sport as Sport,
      capacity: c.capacity,
      price_per_slot: Number(c.price_per_slot),
      image_url: c.image_url,
      is_popular: (counts.get(c.id) ?? 0) >= 3,
      is_new: c.created_at
        ? new Date(c.created_at).getTime() >= newCutoff
        : false,
    })),
  };

  if (courts.length === 0) {
    return {
      text: sport
        ? `No active ${sport} courts at the moment.`
        : "No active courts available.",
    };
  }

  const summary = courts
    .map(
      (c) =>
        `- ${c.name} (${c.sport}, up to ${c.capacity}, ${Number(c.price_per_slot).toFixed(3)} KWD/slot)`,
    )
    .join("\n");
  return {
    text: `Showing ${courts.length} active courts to the user:\n${summary}`,
    widget,
  };
}

async function runListDates(args: Record<string, unknown>): Promise<ToolResult> {
  const courtId = typeof args.court_id === "string" ? args.court_id : "";
  if (!courtId) {
    return {
      text: "Error: court_id is required. The user hasn't picked a court yet — call list_courts first so they can pick one, then call list_dates with the chosen court_id.",
    };
  }

  const supabase = createServerClient();
  const { data: court, error: courtErr } = await supabase
    .from("courts")
    .select("id, name, sport, is_active")
    .eq("id", courtId)
    .maybeSingle();
  if (courtErr) return { text: `Error: ${courtErr.message}` };
  if (!court || !court.is_active)
    return { text: "Court not found or inactive." };

  const days = nextNDaysIso(BOOKING_WINDOW_DAYS);
  const windowStart = kuwaitDateToUtcRange(days[0]).startUtc;
  const windowEnd = kuwaitDateToUtcRange(days[days.length - 1]).endUtc;

  const { data: slots, error: slotErr } = await supabase
    .from("slots")
    .select("start_time, status")
    .eq("court_id", courtId)
    .gte("start_time", windowStart)
    .lt("start_time", windowEnd);
  if (slotErr) return { text: `Error: ${slotErr.message}` };

  const nowMs = Date.now();
  const summary = days.map((day) => {
    const range = kuwaitDateToUtcRange(day);
    const dayRows = (slots ?? []).filter(
      (s) =>
        s.start_time >= range.startUtc && s.start_time < range.endUtc,
    );
    const open = dayRows.filter(
      (s) =>
        s.status === "open" && new Date(s.start_time).getTime() > nowMs,
    ).length;
    return { date: day, open_count: open };
  });

  return {
    text: `${court.name} availability over the next ${BOOKING_WINDOW_DAYS} days. Days with open slots: ${summary.filter((d) => d.open_count > 0).length}.`,
    widget: {
      type: "date_picker",
      court_id: court.id,
      court_name: court.name,
      sport: court.sport as Sport,
      days: summary,
    },
  };
}

async function runListSlots(args: Record<string, unknown>): Promise<ToolResult> {
  const courtId = typeof args.court_id === "string" ? args.court_id : "";
  const date = typeof args.date === "string" ? args.date : "";
  if (!courtId) {
    return {
      text: "Error: court_id is required. The user hasn't picked a court yet — call list_courts first so they can pick one, then list_slots with the chosen court_id.",
    };
  }
  if (!date) {
    return {
      text: "Error: date is required (YYYY-MM-DD). Call list_dates first if the user hasn't chosen a date, otherwise pass the date the user mentioned (e.g. tomorrow's date in Kuwait time).",
    };
  }

  const supabase = createServerClient();
  const { data: court } = await supabase
    .from("courts")
    .select("id, name, sport, is_active")
    .eq("id", courtId)
    .maybeSingle();
  if (!court || !court.is_active) return { text: "Court not found." };

  const range = kuwaitDateToUtcRange(date);
  const { data: slots, error } = await supabase
    .from("slots")
    .select("id, start_time, end_time, status")
    .eq("court_id", courtId)
    .gte("start_time", range.startUtc)
    .lt("start_time", range.endUtc)
    .order("start_time", { ascending: true });
  if (error) return { text: `Error: ${error.message}` };

  const nowMs = Date.now();
  const enriched = (slots ?? []).map((s) => ({
    id: s.id,
    start_time: s.start_time,
    end_time: s.end_time,
    status: s.status as "open" | "booked" | "closed",
    is_past: new Date(s.start_time).getTime() <= nowMs,
  }));
  const openCount = enriched.filter(
    (s) => s.status === "open" && !s.is_past,
  ).length;

  return {
    text: `${court.name} on ${date}: ${openCount} open slots, ${enriched.length} total.`,
    widget: {
      type: "slot_picker",
      court_id: court.id,
      court_name: court.name,
      sport: court.sport as Sport,
      date,
      slots: enriched,
    },
  };
}

async function runPrepareBooking(
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const courtId = typeof args.court_id === "string" ? args.court_id : "";
  const slotId = typeof args.slot_id === "string" ? args.slot_id : "";
  if (!courtId || !slotId) {
    return { text: "Error: court_id and slot_id are required." };
  }

  const supabase = createServerClient();
  const [{ data: court }, { data: slot }] = await Promise.all([
    supabase
      .from("courts")
      .select("id, name, sport, price_per_slot, is_active")
      .eq("id", courtId)
      .maybeSingle(),
    supabase
      .from("slots")
      .select("id, start_time, end_time, status")
      .eq("id", slotId)
      .maybeSingle(),
  ]);

  if (!court || !court.is_active) return { text: "Court not found." };
  if (!slot) return { text: "Slot not found." };
  if (slot.status !== "open") return { text: "That slot is no longer open." };
  if (new Date(slot.start_time).getTime() <= Date.now()) {
    return { text: "That slot has already started." };
  }

  return {
    text: `Showing booking confirmation card to the user: ${court.name}, ${slot.start_time} → ${slot.end_time}, ${Number(court.price_per_slot).toFixed(3)} KWD.`,
    widget: {
      type: "confirm_booking",
      court_id: court.id,
      court_name: court.name,
      sport: court.sport as Sport,
      slot_id: slot.id,
      start_time: slot.start_time,
      end_time: slot.end_time,
      price: Number(court.price_per_slot),
    },
  };
}

export function customerSystemPrompt(courtsHint: string): string {
  const today = kuwaitTodayIso();
  return `You are a friendly conversational booking assistant for **Smash Courts Kuwait** — a sports court booking facility in Salmiya, Kuwait. Your job is to help the customer book a court in as few steps as possible.

# How to behave
- Be brief. Customers want to book quickly — don't lecture.
- After every tool call, the user is shown a rich UI widget (court grid / date grid / slot grid / confirm card). Your text response should be short — the widget speaks for itself. One sentence is plenty.
- Reply in the customer's language. Detect from their last message; default to English.
- Never invent court names, prices, slot IDs, or times. They only exist if a tool call returned them.
- The booking is NOT created by you. After prepare_booking, the user clicks a "Confirm and pay" button in the confirm widget which does the real booking + redirect to MyFatoorah.

# Tool sequencing — STRICT
The tools have a required order. You MUST get a court_id before list_dates / list_slots / prepare_booking, and a slot_id before prepare_booking. If you don't have those yet, call the earlier tool first.

  no court chosen        → call list_courts (optional sport filter)
  court chosen, no date  → call list_dates with court_id
  court + date, no slot  → call list_slots with court_id + date
  court + slot picked    → call prepare_booking with both ids

When the user mentions a date but hasn't picked a court ("what's open tomorrow", "play padel on Friday"), call list_courts first — DO NOT call list_dates or list_slots without a court_id. The court widget that appears will let them pick one, then you continue to the date step.

Don't apologise for "not being able to load" something — just call the right earlier tool. The user shouldn't see plumbing errors.

# Today
- Today's Kuwait date: ${today}
- Slots are 60 minutes each, 8 AM to 11 PM, bookable up to ${BOOKING_WINDOW_DAYS} days in advance.

# Courts available right now
${courtsHint}

# Out of scope
You only handle court bookings at this facility. If asked about other things (other businesses, general advice, refunds, admin operations) politely say you only handle bookings and offer to start one.`;
}
