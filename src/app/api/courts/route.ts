import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo/mode";
import { listActiveCourts } from "@/lib/demo/store";
import type { Court } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public court list with two computed badges:
//   is_new     — court row created within BADGE_NEW_DAYS days
//   is_popular — at least BADGE_POPULAR_THRESHOLD confirmed/completed
//                bookings created in the same window
// Both are derived at request time from the bookings table — no
// persistence, so they update as activity changes.
const COURT_FIELDS =
  "id, name, sport, description, capacity, price_per_slot, slot_duration_minutes, image_url, created_at";

const BADGE_WINDOW_DAYS = 30;
const BADGE_NEW_DAYS = 30;
const BADGE_POPULAR_THRESHOLD = 3;

type CourtRow = Court & { created_at: string };

export async function GET() {
  if (isDemoMode()) {
    return NextResponse.json({ courts: listActiveCourts() });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courts")
    .select(COURT_FIELDS)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return jsonError(error.message, 500);

  const courts = (data ?? []) as CourtRow[];

  // Bookings-per-court over the last BADGE_WINDOW_DAYS days. Declined +
  // cancelled don't count — those represent abandoned attempts, not
  // demand.
  const since = new Date(
    Date.now() - BADGE_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const counts = new Map<string, number>();
  const { data: bookingRows } = await supabase
    .from("bookings")
    .select("court_id, status")
    .gte("created_at", since)
    .in("status", ["confirmed", "completed"]);
  for (const row of bookingRows ?? []) {
    const id = (row as { court_id: string | null }).court_id;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  const newCutoffMs = Date.now() - BADGE_NEW_DAYS * 24 * 60 * 60 * 1000;

  const enriched: Court[] = courts.map((c) => {
    const createdMs = c.created_at ? new Date(c.created_at).getTime() : 0;
    const bookings = counts.get(c.id) ?? 0;
    return {
      id: c.id,
      name: c.name,
      sport: c.sport,
      description: c.description,
      capacity: c.capacity,
      price_per_slot: c.price_per_slot,
      slot_duration_minutes: c.slot_duration_minutes,
      image_url: c.image_url,
      is_new: createdMs > 0 && createdMs >= newCutoffMs,
      is_popular: bookings >= BADGE_POPULAR_THRESHOLD,
    };
  });

  return NextResponse.json({ courts: enriched });
}
