import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/demo/mode";
import { listActiveCourts, listSlotsInRange } from "@/lib/demo/store";
import {
  BOOKING_WINDOW_DAYS,
  kuwaitDateToUtcRange,
  nextNDaysIso,
} from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET() {
  if (isDemoMode()) {
    const courts = listActiveCourts();
    const days = nextNDaysIso(BOOKING_WINDOW_DAYS);
    const startUtc = kuwaitDateToUtcRange(days[0]).startUtc;
    const endUtc = kuwaitDateToUtcRange(days[days.length - 1]).endUtc;
    const totalSlots = courts.reduce(
      (sum, c) => sum + listSlotsInRange(c.id, startUtc, endUtc).length,
      0,
    );
    return NextResponse.json({
      ok: true,
      db: "demo",
      courts: courts.length,
      slots: totalSlots,
      time: new Date().toISOString(),
    });
  }

  try {
    const supabase = createServerClient();
    const [courtsRes, slotsRes] = await Promise.all([
      supabase.from("courts").select("*", { count: "exact", head: true }),
      supabase.from("slots").select("*", { count: "exact", head: true }),
    ]);

    if (courtsRes.error || slotsRes.error) {
      return NextResponse.json(
        {
          ok: false,
          db: "error",
          error: courtsRes.error?.message ?? slotsRes.error?.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      db: "up",
      courts: courtsRes.count ?? 0,
      slots: slotsRes.count ?? 0,
      time: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, db: "down", error: message }, { status: 500 });
  }
}
