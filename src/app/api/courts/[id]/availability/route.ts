import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";
import {
  BOOKING_WINDOW_DAYS,
  kuwaitDateToUtcRange,
  nextNDaysIso,
} from "@/lib/time";
import { isDemoMode } from "@/lib/demo/mode";
import { getCourtById, listSlotsInRange } from "@/lib/demo/store";

export const dynamic = "force-dynamic";

type DaySummary = { date: string; open_count: number; total_count: number };

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return jsonError("court_not_found", 404);

  const days = nextNDaysIso(BOOKING_WINDOW_DAYS);
  const windowStart = kuwaitDateToUtcRange(days[0]).startUtc;
  const windowEnd = kuwaitDateToUtcRange(days[days.length - 1]).endUtc;

  // open_count excludes slots whose start_time is in the past so a day
  // of expired slots renders as fully unavailable rather than "open".
  const nowMs = Date.now();
  const isFuture = (startTime: string) =>
    new Date(startTime).getTime() > nowMs;

  if (isDemoMode()) {
    const court = getCourtById(params.id);
    if (!court) return jsonError("court_not_found", 404);
    const all = listSlotsInRange(params.id, windowStart, windowEnd);
    const summary = days.map<DaySummary>((d) => {
      const range = kuwaitDateToUtcRange(d);
      const dayRows = all.filter(
        (s) => s.start_time >= range.startUtc && s.start_time < range.endUtc,
      );
      return {
        date: d,
        open_count: dayRows.filter(
          (s) => s.status === "open" && isFuture(s.start_time),
        ).length,
        total_count: dayRows.length,
      };
    });
    return NextResponse.json({ days: summary });
  }

  const supabase = createServerClient();

  const { data: court, error: courtErr } = await supabase
    .from("courts")
    .select("id, is_active")
    .eq("id", params.id)
    .maybeSingle();
  if (courtErr) return jsonError(courtErr.message, 500);
  if (!court || !court.is_active) return jsonError("court_not_found", 404);

  const { data, error } = await supabase
    .from("slots")
    .select("start_time, status")
    .eq("court_id", params.id)
    .gte("start_time", windowStart)
    .lt("start_time", windowEnd);

  if (error) return jsonError(error.message, 500);

  const buckets = new Map<string, { total: number; open: number }>(
    days.map((d) => [d, { total: 0, open: 0 }]),
  );

  for (const row of data ?? []) {
    for (const day of days) {
      const range = kuwaitDateToUtcRange(day);
      if (row.start_time >= range.startUtc && row.start_time < range.endUtc) {
        const b = buckets.get(day)!;
        b.total += 1;
        if (row.status === "open" && isFuture(row.start_time)) b.open += 1;
        break;
      }
    }
  }

  const summary: DaySummary[] = days.map((date) => {
    const b = buckets.get(date)!;
    return { date, open_count: b.open, total_count: b.total };
  });

  return NextResponse.json({ days: summary });
}
