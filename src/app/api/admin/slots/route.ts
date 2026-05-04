import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";
import { isValidIsoDate, kuwaitDateToUtcRange } from "@/lib/time";
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
