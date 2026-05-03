import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { validateBookingInput, generateReference } from "@/lib/booking";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_REFERENCE_RETRIES = 3;

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = validateBookingInput(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.failures },
      { status: 400 },
    );
  }
  const input = parsed.value;

  const supabase = createServerClient();

  const { data: slot, error: slotErr } = await supabase
    .from("slots")
    .select("id, court_id, status")
    .eq("id", input.slot_id)
    .maybeSingle();
  if (slotErr) return jsonError(slotErr.message, 500);
  if (!slot) return jsonError("slot_not_found", 404);
  if (slot.status !== "open") return jsonError("slot_not_available", 409);

  const { data: court, error: courtErr } = await supabase
    .from("courts")
    .select("id, price_per_slot, is_active")
    .eq("id", slot.court_id)
    .maybeSingle();
  if (courtErr) return jsonError(courtErr.message, 500);
  if (!court || !court.is_active) return jsonError("court_not_found", 404);

  // Reference collisions are astronomically unlikely (32^8 ≈ 1.1e12), but the
  // unique index will reject one if it ever happens — retry a few times.
  for (let attempt = 0; attempt < MAX_REFERENCE_RETRIES; attempt++) {
    const reference = generateReference();
    const { data, error } = await supabase.rpc("create_booking", {
      p_slot_id: input.slot_id,
      p_court_id: slot.court_id,
      p_name: input.customer_name,
      p_phone: input.customer_phone,
      p_email: input.customer_email,
      p_notes: input.notes,
      p_price: court.price_per_slot,
      p_reference: reference,
    });

    if (!error) {
      return NextResponse.json({ booking: data as Booking }, { status: 201 });
    }

    const msg = error.message ?? "";
    if (msg.includes("slot_not_available")) {
      return jsonError("slot_not_available", 409);
    }
    if (msg.includes("bookings_reference_key")) {
      // Reference collision — try a fresh one.
      continue;
    }
    return jsonError(msg || "booking_failed", 500);
  }

  return jsonError("reference_collision", 500);
}
