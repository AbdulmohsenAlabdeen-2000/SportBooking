import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { validateCourtInput, type CourtInput } from "@/lib/court";
import {
  BOOKING_WINDOW_DAYS,
  KUWAIT_OFFSET_HOURS,
  nextNDaysIso,
} from "@/lib/time";
import type { Court } from "@/lib/types";

export const dynamic = "force-dynamic";

const SLOT_HOURS = Array.from({ length: 15 }, (_, i) => 8 + i); // 08:00–22:00 starts

function kuwaitDateAtHourToUtcIso(dateIso: string, hour: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hour - KUWAIT_OFFSET_HOURS, 0, 0, 0);
  return new Date(utcMs).toISOString();
}

// GET — list ALL courts (active and inactive). The customer-facing
// /api/courts only returns is_active=true; admins need the full picture
// to reactivate or rename.
export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courts")
    .select(
      "id, name, sport, description, capacity, price_per_slot, slot_duration_minutes, image_url, is_active, created_at",
    )
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });
  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ courts: data ?? [] });
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = validateCourtInput(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.failures },
      { status: 400 },
    );
  }
  const input = parsed.value as CourtInput;

  const supabase = createServerClient();

  const { data: court, error } = await supabase
    .from("courts")
    .insert({
      name: input.name,
      sport: input.sport,
      description: input.description ?? null,
      capacity: input.capacity,
      price_per_slot: input.price_per_slot,
      slot_duration_minutes: input.slot_duration_minutes,
      is_active: input.is_active,
    })
    .select()
    .maybeSingle();

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return jsonError("name_taken", 409);
    }
    return jsonError(error.message, 500);
  }
  if (!court) return jsonError("court_create_failed", 500);

  // Auto-generate the next 14 days of open slots so the new court is
  // immediately bookable. Uses ignoreDuplicates so re-running is safe.
  if (input.is_active) {
    const days = nextNDaysIso(BOOKING_WINDOW_DAYS);
    const rows = [];
    for (const day of days) {
      for (const hour of SLOT_HOURS) {
        rows.push({
          court_id: court.id,
          start_time: kuwaitDateAtHourToUtcIso(day, hour),
          end_time: kuwaitDateAtHourToUtcIso(day, hour + 1),
          status: "open" as const,
        });
      }
    }
    const { error: slotErr } = await supabase
      .from("slots")
      .upsert(rows, {
        onConflict: "court_id,start_time",
        ignoreDuplicates: true,
      });
    if (slotErr) {
      // Don't fail the whole create — court is in, slots can be added
      // later from /admin/slots.
      console.error("Auto-slot creation failed for court", court.id, slotErr.message);
    }
  }

  return NextResponse.json({ court: court as Court }, { status: 201 });
}
