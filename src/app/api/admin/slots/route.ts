import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";
import { isValidIsoDate, kuwaitDateToUtcRange } from "@/lib/time";
import { isDemoMode } from "@/lib/demo/mode";
import {
  getCourtById as demoGetCourt,
  listAllBookingsInRange as demoBookingsInRange,
  listSlotsInRange as demoSlotsInRange,
} from "@/lib/demo/store";
import type { SlotStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_RANGE_DAYS = 14;

function dayDiff(fromIso: string, toIso: string): number {
  const [yf, mf, df] = fromIso.split("-").map(Number);
  const [yt, mt, dt] = toIso.split("-").map(Number);
  return Math.round(
    (Date.UTC(yt, mt - 1, dt) - Date.UTC(yf, mf - 1, df)) / 86_400_000,
  );
}

type Row = {
  id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  bookings:
    | { reference: string; customer_name: string; status: string }
    | { reference: string; customer_name: string; status: string }[]
    | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const courtId = url.searchParams.get("court_id");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  if (!courtId || !isUuid(courtId)) return jsonError("invalid_court_id", 400);
  if (!from || !isValidIsoDate(from)) return jsonError("invalid_from", 400);
  if (!to || !isValidIsoDate(to)) return jsonError("invalid_to", 400);
  const span = dayDiff(from, to);
  if (span < 0 || span > MAX_RANGE_DAYS) return jsonError("range_too_wide", 400);

  const startUtc = kuwaitDateToUtcRange(from).startUtc;
  const endUtc = kuwaitDateToUtcRange(to).endUtc;

  if (isDemoMode()) {
    if (!demoGetCourt(courtId)) return jsonError("court_not_found", 404);
    const slots = demoSlotsInRange(courtId, startUtc, endUtc);
    const bookings = demoBookingsInRange(startUtc, endUtc);
    const bookingBySlot = new Map(bookings.filter((b) => b.status !== "cancelled").map((b) => [b.slot_id, b]));
    return NextResponse.json({
      slots: slots.map((s) => {
        const b = bookingBySlot.get(s.id);
        return {
          id: s.id,
          court_id: s.court_id,
          start_time: s.start_time,
          end_time: s.end_time,
          status: s.status,
          booking:
            s.status === "booked" && b
              ? { reference: b.reference, customer_name: b.customer_name }
              : null,
        };
      }),
    });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("slots")
    .select(
      `
      id,
      court_id,
      start_time,
      end_time,
      status,
      bookings(reference, customer_name, status)
    `,
    )
    .eq("court_id", courtId)
    .gte("start_time", startUtc)
    .lt("start_time", endUtc)
    .order("start_time", { ascending: true });

  if (error) return jsonError(error.message, 500);

  const slots = ((data ?? []) as Row[]).map((r) => {
    // Pick the active booking row (exclude cancelled). The schema enforces
    // uniqueness on slot_id, but the booking history could theoretically
    // include a prior cancelled row if the data model evolves later.
    const arr = Array.isArray(r.bookings)
      ? r.bookings
      : r.bookings
        ? [r.bookings]
        : [];
    const active = arr.find((b) => b.status !== "cancelled") ?? null;
    return {
      id: r.id,
      court_id: r.court_id,
      start_time: r.start_time,
      end_time: r.end_time,
      status: r.status,
      booking:
        r.status === "booked" && active
          ? {
              reference: active.reference,
              customer_name: active.customer_name,
            }
          : null,
    };
  });

  return NextResponse.json({ slots });
}

// POST /api/admin/slots — create a custom slot outside the default
// 08:00–22:00 window (e.g., a 23:00 slot for a special event). Body:
// { court_id, start_time, end_time }. start_time/end_time are ISO 8601.
// 409 if (court_id, start_time) already exists.
type CreateBody = {
  court_id?: string;
  start_time?: string;
  end_time?: string;
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/;

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return jsonError("invalid_json", 400);
  }
  const courtId = body.court_id ?? "";
  const startTime = body.start_time ?? "";
  const endTime = body.end_time ?? "";

  if (!isUuid(courtId)) return jsonError("invalid_court_id", 400);
  if (!ISO_RE.test(startTime)) return jsonError("invalid_start_time", 400);
  if (!ISO_RE.test(endTime)) return jsonError("invalid_end_time", 400);

  const startMs = Date.parse(startTime);
  const endMs = Date.parse(endTime);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    return jsonError("invalid_time_range", 400);
  }
  if (endMs <= startMs) return jsonError("invalid_time_range", 400);

  const supabase = createServerClient();

  // Confirm the court exists; we want a clean 404 instead of an FK error.
  const { data: court, error: courtErr } = await supabase
    .from("courts")
    .select("id, is_active")
    .eq("id", courtId)
    .maybeSingle();
  if (courtErr) return jsonError(courtErr.message, 500);
  if (!court) return jsonError("court_not_found", 404);

  const { data, error } = await supabase
    .from("slots")
    .insert({
      court_id: courtId,
      start_time: new Date(startMs).toISOString(),
      end_time: new Date(endMs).toISOString(),
      status: "open",
    })
    .select("id, court_id, start_time, end_time, status")
    .maybeSingle();

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return jsonError("slot_exists", 409);
    }
    return jsonError(error.message, 500);
  }
  if (!data) return jsonError("slot_create_failed", 500);

  return NextResponse.json({ slot: data }, { status: 201 });
}
