import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import {
  BOOKING_WINDOW_DAYS,
  KUWAIT_OFFSET_HOURS,
  nextNDaysIso,
} from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLOT_HOURS = Array.from({ length: 15 }, (_, i) => 8 + i);

function kuwaitDateAtHourToUtcIso(dateIso: string, hour: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hour - KUWAIT_OFFSET_HOURS, 0, 0, 0);
  return new Date(utcMs).toISOString();
}

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` with each invocation.
// Reject anything without the matching secret so the endpoint can't be hit
// from the open internet to grind the DB. Same logic as
// /api/admin/slots/ensure but auth is the shared secret, not an admin session.
function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return jsonError("unauthorized", 401);

  const supabase = createServerClient();
  const { data: courts, error: courtsErr } = await supabase
    .from("courts")
    .select("id")
    .eq("is_active", true);
  if (courtsErr) return jsonError(courtsErr.message, 500);
  if (!courts || courts.length === 0) {
    return NextResponse.json({ inserted: 0, courts: 0, days: 0 });
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
    courts: courts.length,
    days: days.length,
    ranAt: new Date().toISOString(),
  });
}
