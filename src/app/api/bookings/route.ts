import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { validateBookingInput } from "@/lib/booking";
import { generateBookingReference } from "@/lib/reference";
import { getClientIp, isLoopback, rateLimit } from "@/lib/ratelimit";
import { isDemoMode } from "@/lib/demo/mode";
import {
  createBooking as demoCreateBooking,
  getCourtById as demoGetCourtById,
  getSlotById as demoGetSlotById,
} from "@/lib/demo/store";

export const dynamic = "force-dynamic";

const MAX_REFERENCE_RETRIES = 3;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (!isLoopback(ip)) {
    const rl = rateLimit(`POST:/api/bookings:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000)).toString(),
          },
        },
      );
    }
  }

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

  if (isDemoMode()) {
    const result = demoCreateBooking({
      slot_id: input.slot_id,
      customer_name: input.customer_name,
      customer_phone: input.customer_phone,
      customer_email: input.customer_email,
      notes: input.notes,
    });
    if (!result.ok) {
      const status =
        result.error === "slot_not_found"
          ? 404
          : result.error === "court_not_found"
            ? 404
            : 409;
      return jsonError(result.error, status);
    }
    const slot = demoGetSlotById(result.booking.slot_id);
    const court = demoGetCourtById(result.booking.court_id);
    return NextResponse.json(
      {
        booking: {
          reference: result.booking.reference,
          court: court
            ? { id: court.id, name: court.name, sport: court.sport }
            : null,
          slot: slot ? { start_time: slot.start_time, end_time: slot.end_time } : null,
          customer_name: result.booking.customer_name,
          customer_phone: result.booking.customer_phone,
          total_price: result.booking.total_price,
          status: result.booking.status,
          created_at: result.booking.created_at,
        },
      },
      { status: 201 },
    );
  }

  const supabase = createServerClient();

  const { data: slot, error: slotErr } = await supabase
    .from("slots")
    .select("id, court_id, status, start_time, end_time")
    .eq("id", input.slot_id)
    .maybeSingle();
  if (slotErr) return jsonError(slotErr.message, 500);
  if (!slot) return jsonError("slot_not_found", 404);
  if (slot.status !== "open") return jsonError("slot_not_available", 409);

  const { data: court, error: courtErr } = await supabase
    .from("courts")
    .select("id, name, sport, price_per_slot, is_active")
    .eq("id", slot.court_id)
    .maybeSingle();
  if (courtErr) return jsonError(courtErr.message, 500);
  if (!court || !court.is_active) return jsonError("court_not_found", 404);

  for (let attempt = 0; attempt < MAX_REFERENCE_RETRIES; attempt++) {
    const reference = generateBookingReference();
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

    if (!error && data) {
      const row = data as {
        reference: string;
        customer_name: string;
        customer_phone: string;
        total_price: number | string;
        status: string;
        created_at: string;
      };
      return NextResponse.json(
        {
          booking: {
            reference: row.reference,
            court: { id: court.id, name: court.name, sport: court.sport },
            slot: { start_time: slot.start_time, end_time: slot.end_time },
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            total_price: Number(row.total_price),
            status: row.status,
            created_at: row.created_at,
          },
        },
        { status: 201 },
      );
    }

    const msg = error?.message ?? "";
    if (msg.includes("slot_not_available")) {
      return jsonError("slot_not_available", 409);
    }
    if (msg.includes("bookings_reference_key")) {
      continue;
    }
    return jsonError(msg || "booking_failed", 500);
  }

  return jsonError("reference_collision", 500);
}
