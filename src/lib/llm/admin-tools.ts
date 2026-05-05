import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import {
  kuwaitDateToUtcRange,
  kuwaitTodayIso,
} from "@/lib/time";
import type { ToolDef } from "@/lib/llm/openrouter";
import type { Sport } from "@/lib/types";

// Admin assistant tools. Read-mostly with one safe write
// (mark_completed). Money-moving actions (cancel + refund, price
// changes) intentionally aren't exposed — those still need the browser
// admin UI where the operator can see what they're confirming.
//
// Every tool result includes a textual summary the model can speak
// about, and most include a widget the admin sees inline (stats card,
// booking list, single-booking card, etc.).

export type AdminWidget =
  | {
      type: "today_summary";
      date: string;
      stats: {
        total: number;
        confirmed: number;
        completed: number;
        cancelled: number;
        revenue_kwd: number;
      };
    }
  | {
      type: "total_revenue";
      revenue_kwd: number;
    }
  | {
      type: "week_chart";
      days: Array<{
        date: string;
        confirmed: number;
        cancelled: number;
        revenue_kwd: number;
      }>;
    }
  | {
      type: "booking_list";
      title: string;
      bookings: Array<{
        reference: string;
        customer_name: string;
        customer_phone: string;
        court_name: string | null;
        sport: Sport | null;
        start_time: string | null;
        end_time: string | null;
        total_price: number;
        status: string;
      }>;
    }
  | {
      type: "booking_detail";
      reference: string;
      customer_name: string;
      customer_phone: string;
      customer_email: string | null;
      court_name: string | null;
      sport: Sport | null;
      start_time: string | null;
      end_time: string | null;
      total_price: number;
      status: string;
      payment_invoice_id: string | null;
      paid_at: string | null;
      refund_id: string | null;
      refunded_at: string | null;
      notes: string | null;
    }
  | {
      type: "completed_confirmation";
      reference: string;
      previous_status: string;
    };

export type AdminToolResult = { text: string; widget?: AdminWidget };

export const ADMIN_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "today_summary",
      description:
        "Today's bookings stats and revenue. Use for any 'today' question, e.g. 'how many bookings today', 'today's revenue'. Returns a stats card.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "total_revenue",
      description:
        "Lifetime revenue across every confirmed/completed booking ever. Cancelled bookings (refunded) are excluded.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "week_chart",
      description:
        "Last 7 days of booking counts (confirmed + cancelled) and per-day revenue. Useful for trend / comparison questions.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "find_booking",
      description:
        "Look up one booking by its reference (e.g. 'BK-2026-ABC12'). Returns customer info, court, slot times, status, and payment fields.",
      parameters: {
        type: "object",
        properties: {
          reference: {
            type: "string",
            description: "Booking reference, format BK-YYYY-XXXXX.",
          },
        },
        required: ["reference"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recent_bookings",
      description:
        "List recent bookings with optional filters. Defaults to the next 30 days starting today. Use this for 'show me cancellations this week', 'tennis bookings tomorrow', etc.",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["confirmed", "completed", "cancelled", "all"],
            description: "Filter by status. Defaults to 'all'.",
          },
          sport: {
            type: "string",
            description:
              "Filter by sport (e.g. padel, tennis, football). Optional.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 50,
            description: "Max bookings to return. Defaults to 10.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_completed",
      description:
        "Flip a confirmed booking to completed. The slot stays booked. Safe write — no refund, no money movement. Use only after the customer played the match. The admin sees a confirmation card after the change.",
      parameters: {
        type: "object",
        properties: {
          reference: {
            type: "string",
            description: "Booking reference to mark completed.",
          },
        },
        required: ["reference"],
      },
    },
  },
];

const REFERENCE_RE = /^[A-Z]{2,4}-[A-Z0-9-]{4,30}$/;

export async function runAdminTool(
  name: string,
  rawArgs: string,
): Promise<AdminToolResult> {
  let args: Record<string, unknown>;
  try {
    args = rawArgs.trim() ? JSON.parse(rawArgs) : {};
  } catch {
    return { text: `Error: invalid JSON args: ${rawArgs}` };
  }

  switch (name) {
    case "today_summary":
      return await runTodaySummary();
    case "total_revenue":
      return await runTotalRevenue();
    case "week_chart":
      return await runWeekChart();
    case "find_booking":
      return await runFindBooking(args);
    case "recent_bookings":
      return await runRecentBookings(args);
    case "mark_completed":
      return await runMarkCompleted(args);
    default:
      return { text: `Error: unknown tool "${name}".` };
  }
}

async function runTodaySummary(): Promise<AdminToolResult> {
  const supabase = createServerClient();
  const today = kuwaitTodayIso();
  const { startUtc, endUtc } = kuwaitDateToUtcRange(today);
  const { data, error } = await supabase
    .from("bookings")
    .select("status, total_price, slot:slots!inner(start_time)")
    .gte("slot.start_time", startUtc)
    .lt("slot.start_time", endUtc)
    .neq("status", "declined");
  if (error) return { text: `Error: ${error.message}` };

  type Row = {
    status: string;
    total_price: number | string;
  };
  const rows = ((data ?? []) as Row[]) ?? [];
  const total = rows.length;
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const completed = rows.filter((r) => r.status === "completed").length;
  const cancelled = rows.filter((r) => r.status === "cancelled").length;
  const revenue = rows
    .filter((r) => r.status === "confirmed" || r.status === "completed")
    .reduce((s, r) => s + Number(r.total_price), 0);

  return {
    text: `Today (${today}) — ${total} bookings (${confirmed} confirmed, ${completed} completed, ${cancelled} cancelled). Revenue today: ${revenue.toFixed(3)} KWD.`,
    widget: {
      type: "today_summary",
      date: today,
      stats: { total, confirmed, completed, cancelled, revenue_kwd: revenue },
    },
  };
}

async function runTotalRevenue(): Promise<AdminToolResult> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("total_price, status")
    .in("status", ["confirmed", "completed"]);
  if (error) return { text: `Error: ${error.message}` };
  const revenue = ((data ?? []) as Array<{ total_price: number | string }>)
    .reduce((s, r) => s + Number(r.total_price), 0);
  return {
    text: `Lifetime revenue: ${revenue.toFixed(3)} KWD.`,
    widget: { type: "total_revenue", revenue_kwd: revenue },
  };
}

async function runWeekChart(): Promise<AdminToolResult> {
  const supabase = createServerClient();
  const today = kuwaitTodayIso();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - i);
    days.push(dt.toISOString().slice(0, 10));
  }
  const startUtc = kuwaitDateToUtcRange(days[0]).startUtc;
  const endUtc = kuwaitDateToUtcRange(days[days.length - 1]).endUtc;
  const { data, error } = await supabase
    .from("bookings")
    .select("total_price, status, slot:slots!inner(start_time)")
    .gte("slot.start_time", startUtc)
    .lt("slot.start_time", endUtc);
  if (error) return { text: `Error: ${error.message}` };

  type Row = {
    total_price: number | string;
    status: string;
    slot: { start_time: string } | { start_time: string }[];
  };

  const buckets = new Map(
    days.map((d) => [
      d,
      { date: d, confirmed: 0, cancelled: 0, revenue_kwd: 0 },
    ]),
  );
  for (const row of (data ?? []) as Row[]) {
    if (row.status === "declined" || row.status === "pending_payment") continue;
    const slot = Array.isArray(row.slot) ? row.slot[0] : row.slot;
    if (!slot) continue;
    for (const day of days) {
      const range = kuwaitDateToUtcRange(day);
      if (slot.start_time >= range.startUtc && slot.start_time < range.endUtc) {
        const b = buckets.get(day)!;
        if (row.status === "cancelled") b.cancelled += 1;
        else {
          b.confirmed += 1;
          b.revenue_kwd += Number(row.total_price);
        }
        break;
      }
    }
  }
  const arr = Array.from(buckets.values());
  const totalConfirmed = arr.reduce((s, d) => s + d.confirmed, 0);
  const totalCancelled = arr.reduce((s, d) => s + d.cancelled, 0);
  const totalRevenue = arr.reduce((s, d) => s + d.revenue_kwd, 0);
  return {
    text: `Last 7 days: ${totalConfirmed} confirmed, ${totalCancelled} cancelled, ${totalRevenue.toFixed(3)} KWD revenue.`,
    widget: { type: "week_chart", days: arr },
  };
}

async function runFindBooking(
  args: Record<string, unknown>,
): Promise<AdminToolResult> {
  const ref = typeof args.reference === "string" ? args.reference.trim() : "";
  if (!REFERENCE_RE.test(ref)) {
    return { text: "Error: not a valid booking reference." };
  }
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "reference, customer_name, customer_phone, customer_email, total_price, status, payment_invoice_id, paid_at, refund_id, refunded_at, notes, court:courts(name, sport), slot:slots(start_time, end_time)",
    )
    .eq("reference", ref)
    .maybeSingle<{
      reference: string;
      customer_name: string;
      customer_phone: string;
      customer_email: string | null;
      total_price: number | string;
      status: string;
      payment_invoice_id: string | null;
      paid_at: string | null;
      refund_id: string | null;
      refunded_at: string | null;
      notes: string | null;
      court: { name: string; sport: Sport } | { name: string; sport: Sport }[] | null;
      slot:
        | { start_time: string; end_time: string }
        | { start_time: string; end_time: string }[]
        | null;
    }>();
  if (error) return { text: `Error: ${error.message}` };
  if (!data) return { text: `No booking found for ${ref}.` };

  const court = Array.isArray(data.court) ? data.court[0] : data.court;
  const slot = Array.isArray(data.slot) ? data.slot[0] : data.slot;
  return {
    text: `Found ${data.reference}: ${data.customer_name} (${data.customer_phone}), ${court?.name ?? "?"} on ${slot?.start_time ?? "?"}, ${data.status}.`,
    widget: {
      type: "booking_detail",
      reference: data.reference,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email,
      court_name: court?.name ?? null,
      sport: court?.sport ?? null,
      start_time: slot?.start_time ?? null,
      end_time: slot?.end_time ?? null,
      total_price: Number(data.total_price),
      status: data.status,
      payment_invoice_id: data.payment_invoice_id,
      paid_at: data.paid_at,
      refund_id: data.refund_id,
      refunded_at: data.refunded_at,
      notes: data.notes,
    },
  };
}

async function runRecentBookings(
  args: Record<string, unknown>,
): Promise<AdminToolResult> {
  const status =
    typeof args.status === "string" && args.status !== "all"
      ? args.status
      : null;
  const sport = typeof args.sport === "string" ? args.sport.toLowerCase() : null;
  const limitRaw = Number(args.limit ?? 10);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(50, Math.max(1, Math.floor(limitRaw)))
    : 10;

  const supabase = createServerClient();
  const today = kuwaitTodayIso();
  const startUtc = kuwaitDateToUtcRange(today).startUtc;
  // Look 30 days forward by default.
  const rangeEnd = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  let q = supabase
    .from("bookings")
    .select(
      "reference, customer_name, customer_phone, total_price, status, court:courts(name, sport), slot:slots!inner(start_time, end_time)",
    )
    .gte("slot.start_time", startUtc)
    .lt("slot.start_time", rangeEnd)
    .neq("status", "declined")
    .order("start_time", { foreignTable: "slot", ascending: true })
    .limit(limit);
  if (status) q = q.eq("status", status);
  if (sport) q = q.eq("court.sport", sport);

  const { data, error } = await q;
  if (error) return { text: `Error: ${error.message}` };

  type Row = {
    reference: string;
    customer_name: string;
    customer_phone: string;
    total_price: number | string;
    status: string;
    court: { name: string; sport: Sport } | { name: string; sport: Sport }[] | null;
    slot:
      | { start_time: string; end_time: string }
      | { start_time: string; end_time: string }[]
      | null;
  };

  const rows = (data ?? []) as Row[];
  const items = rows.map((r) => {
    const c = Array.isArray(r.court) ? r.court[0] : r.court;
    const s = Array.isArray(r.slot) ? r.slot[0] : r.slot;
    return {
      reference: r.reference,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      court_name: c?.name ?? null,
      sport: c?.sport ?? null,
      start_time: s?.start_time ?? null,
      end_time: s?.end_time ?? null,
      total_price: Number(r.total_price),
      status: r.status,
    };
  });

  const titleParts = ["Bookings"];
  if (status) titleParts.push(`(${status})`);
  if (sport) titleParts.push(`— ${sport}`);
  const title = titleParts.join(" ");

  return {
    text: `${items.length} bookings matched (status=${status ?? "all"}, sport=${sport ?? "any"}).`,
    widget: {
      type: "booking_list",
      title,
      bookings: items,
    },
  };
}

async function runMarkCompleted(
  args: Record<string, unknown>,
): Promise<AdminToolResult> {
  const ref = typeof args.reference === "string" ? args.reference.trim() : "";
  if (!REFERENCE_RE.test(ref)) {
    return { text: "Error: not a valid booking reference." };
  }
  const supabase = createServerClient();
  const { data: current, error: lookupErr } = await supabase
    .from("bookings")
    .select("reference, status")
    .eq("reference", ref)
    .maybeSingle<{ reference: string; status: string }>();
  if (lookupErr) return { text: `Error: ${lookupErr.message}` };
  if (!current) return { text: `No booking found for ${ref}.` };
  if (current.status !== "confirmed") {
    return {
      text: `Can't mark as completed — current status is ${current.status}, not confirmed.`,
    };
  }

  const { error: updateErr } = await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("reference", ref)
    .eq("status", "confirmed");
  if (updateErr) return { text: `Error: ${updateErr.message}` };

  return {
    text: `${ref} marked completed.`,
    widget: {
      type: "completed_confirmation",
      reference: ref,
      previous_status: current.status,
    },
  };
}

export function adminSystemPrompt(): string {
  return `You are the admin assistant for **Smash Courts Kuwait** booking system. The user is Ahmed (or another authorised admin). Your job is to give them quick read-mostly access to bookings and stats by speaking plainly.

# How to behave
- Be concise and direct. Admins are working — no preamble, no platitudes.
- Prefer tools over guessing. If they ask "today's revenue", call today_summary, don't explain.
- After a tool runs, the user sees a rich widget. Your text response should be one short sentence summarising the data, not a wall of text.
- If they ask to do something destructive (cancel + refund, change prices, delete a court), refuse politely and tell them to use the admin dashboard. Only mark_completed is a safe write here.
- If they ask about a customer's data, return it — they're authorised. Never reveal data about the system itself (env vars, source code, infrastructure) — that's not in your scope.
- Today's Kuwait date: ${kuwaitTodayIso()}.

# Out of scope
You can't cancel bookings or issue refunds — those still go through the dashboard. Tell the admin to use /admin/bookings/[reference] for those actions.`;
}
