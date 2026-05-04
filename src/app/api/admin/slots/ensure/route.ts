import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import {
  BOOKING_WINDOW_DAYS,
  KUWAIT_OFFSET_HOURS,
  kuwaitTodayIso,
  nextNDaysIso,
} from "@/lib/time";
import { isDemoMode } from "@/lib/demo/mode";
import { ensureSlotsForWindow as demoEnsure } from "@/lib/demo/store";

export const dynamic = "force-dynamic";

const SLOT_HOURS = Array.from({ length: 15 }, (_, i) => 8 + i); // 08:00–22:00 starts

function kuwaitDateAtHourToUtcIso(dateIso: string, hour: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hour - KUWAIT_OFFSET_HOURS, 0, 0, 0);
  return new Date(utcMs).toISOString();
}

export async function POST() {
  if (isDemoMode()) {
    const { inserted } = demoEnsure();
    return NextResponse.json({
      inserted,
      days: BOOKING_WINDOW_DAYS,
      todayKuwait: kuwaitTodayIso(),
    });
  }

  const supabase = createServerClient();

  const { data: courts, error: courtsErr } = await supabase
    .from("courts")
    .select("id")
    .eq("is_active", true);
  if (courtsErr) return jsonError(courtsErr.message, 500);
  if (!courts || courts.length === 0) {
    return NextResponse.json({ inserted: 0, days: 0, courts: 0 });
  }

  const days = nextNDaysIso(BOOKING_WINDOW_DAYS);
  const rows: {
    court_id: string;
    start_time: string;
    end_time: string;
    status: "open";
  }[] = [];
  for (const court of courts) {
    for (const day of days) {
      for (const hour of SLOT_HOURS) {
        rows.push({
          court_id: court.id,
          start_time: kuwaitDateAtHourToUtcIso(day, hour),
          end_time: kuwaitDateAtHourToUtcIso(day, hour + 1),
          status: "open",
        });
      }
    }
  }

  // ignoreDuplicates so existing rows (court_id, start_time) keep their state —
  // a closed or booked slot must not be flipped back to open by /ensure.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error, count } = await supabase
      .from("slots")
      .upsert(chunk, {
        onConflict: "court_id,start_time",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (error) return jsonError(error.message, 500);
    inserted += count ?? 0;
  }

  return NextResponse.json({
    inserted,
    days: days.length,
    courts: courts.length,
    todayKuwait: kuwaitTodayIso(),
  });
}
