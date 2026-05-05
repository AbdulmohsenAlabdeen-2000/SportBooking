import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { kuwaitDateToUtcRange, kuwaitTodayIso } from "@/lib/time";
import { isDemoMode } from "@/lib/demo/mode";
import {
  getSlotById as demoGetSlot,
  listAllBookingsInRange as demoBookingsInRange,
} from "@/lib/demo/store";
import type { BookingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type DayBucket = {
  date: string;
  confirmed: number;
  cancelled: number;
  bookings: number; // confirmed + cancelled, kept for chart total label
  revenue_kwd: number;
};

export async function GET() {
  const today = kuwaitTodayIso();
  // Last 7 days inclusive of today: today-6 → today.
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const [y, m, d] = today.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - i);
    days.push(dt.toISOString().slice(0, 10));
  }

  const windowStart = kuwaitDateToUtcRange(days[0]).startUtc;
  const windowEnd = kuwaitDateToUtcRange(days[days.length - 1]).endUtc;

  if (isDemoMode()) {
    const rows = demoBookingsInRange(windowStart, windowEnd);
    const buckets = new Map<string, DayBucket>(
      days.map((d) => [
        d,
        { date: d, confirmed: 0, cancelled: 0, bookings: 0, revenue_kwd: 0 },
      ]),
    );
    for (const row of rows) {
      // Skip declined attempts entirely — payment never went through.
      if (row.status === "declined" || row.status === "pending_payment") continue;
      const slot = demoGetSlot(row.slot_id);
      if (!slot) continue;
      for (const day of days) {
        const range = kuwaitDateToUtcRange(day);
        if (slot.start_time >= range.startUtc && slot.start_time < range.endUtc) {
          const b = buckets.get(day)!;
          if (row.status === "cancelled") {
            b.cancelled += 1;
          } else {
            // confirmed | completed
            b.confirmed += 1;
            b.revenue_kwd += row.total_price;
          }
          b.bookings = b.confirmed + b.cancelled;
          break;
        }
      }
    }
    return NextResponse.json({ days: Array.from(buckets.values()) });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      total_price,
      status,
      slot:slots!inner(start_time)
    `,
    )
    .gte("slot.start_time", windowStart)
    .lt("slot.start_time", windowEnd);

  if (error) return jsonError(error.message, 500);

  const buckets = new Map<string, DayBucket>(
    days.map((d) => [
      d,
      { date: d, confirmed: 0, cancelled: 0, bookings: 0, revenue_kwd: 0 },
    ]),
  );

  type Row = {
    total_price: number | string;
    status: BookingStatus;
    slot: { start_time: string } | { start_time: string }[];
  };

  for (const row of (data ?? []) as Row[]) {
    // Skip declined attempts entirely — payment never went through.
    if (row.status === "declined" || row.status === "pending_payment") continue;
    const slot = Array.isArray(row.slot) ? row.slot[0] : row.slot;
    if (!slot) continue;
    for (const day of days) {
      const range = kuwaitDateToUtcRange(day);
      if (slot.start_time >= range.startUtc && slot.start_time < range.endUtc) {
        const b = buckets.get(day)!;
        if (row.status === "cancelled") {
          b.cancelled += 1;
        } else {
          // confirmed | completed
          b.confirmed += 1;
          b.revenue_kwd += Number(row.total_price);
        }
        b.bookings = b.confirmed + b.cancelled;
        break;
      }
    }
  }

  return NextResponse.json({ days: Array.from(buckets.values()) });
}
