import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo/mode";
import {
  getBookingByReference as demoGetByRef,
  getCourtById as demoGetCourt,
  getSlotById as demoGetSlot,
} from "@/lib/demo/store";

export const dynamic = "force-dynamic";

// Loose shape check — reject obviously wrong input cheaply, but keep the regex
// permissive enough to survive the format change the spec went through (BK- vs
// SC-). The DB lookup is the actual authority.
const REFERENCE_RE = /^[A-Z]{2,4}-[A-Z0-9-]{4,30}$/;

export async function GET(_req: Request, { params }: { params: { reference: string } }) {
  const reference = params.reference;
  if (!REFERENCE_RE.test(reference)) return jsonError("booking_not_found", 404);

  if (isDemoMode()) {
    const booking = demoGetByRef(reference);
    if (!booking) return jsonError("booking_not_found", 404);
    const court = demoGetCourt(booking.court_id);
    const slot = demoGetSlot(booking.slot_id);
    return NextResponse.json({
      booking: {
        reference: booking.reference,
        court: court ? { id: court.id, name: court.name, sport: court.sport } : null,
        slot: slot ? { start_time: slot.start_time, end_time: slot.end_time } : null,
        customer_name: booking.customer_name,
        customer_phone: booking.customer_phone,
        total_price: booking.total_price,
        status: booking.status,
        created_at: booking.created_at,
      },
    });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      reference,
      total_price,
      status,
      customer_name,
      customer_phone,
      created_at,
      court:courts(id, name, sport),
      slot:slots(start_time, end_time)
    `,
    )
    .eq("reference", reference)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("booking_not_found", 404);

  const court = Array.isArray(data.court) ? data.court[0] : data.court;
  const slot = Array.isArray(data.slot) ? data.slot[0] : data.slot;

  return NextResponse.json({
    booking: {
      reference: data.reference,
      court: court ? { id: court.id, name: court.name, sport: court.sport } : null,
      slot: slot ? { start_time: slot.start_time, end_time: slot.end_time } : null,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      total_price: Number(data.total_price),
      status: data.status,
      created_at: data.created_at,
    },
  });
}
