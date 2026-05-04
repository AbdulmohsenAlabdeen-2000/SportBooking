import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import type { BookingStatus, Sport } from "@/lib/types";

export const dynamic = "force-dynamic";

const REFERENCE_RE = /^[A-Z]{2,4}-[A-Z0-9-]{4,30}$/;

export async function GET(
  _req: Request,
  { params }: { params: { reference: string } },
) {
  const reference = params.reference;
  if (!REFERENCE_RE.test(reference)) return jsonError("booking_not_found", 404);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      reference,
      customer_name,
      customer_phone,
      customer_email,
      notes,
      total_price,
      status,
      created_at,
      court:courts(id, name, sport),
      slot:slots(start_time, end_time)
    `,
    )
    .eq("reference", reference)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("booking_not_found", 404);

  type Row = {
    reference: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    notes: string | null;
    total_price: number | string;
    status: BookingStatus;
    created_at: string;
    court: { id: string; name: string; sport: Sport } | { id: string; name: string; sport: Sport }[] | null;
    slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[] | null;
  };

  const r = data as Row;
  const court = Array.isArray(r.court) ? r.court[0] : r.court;
  const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;

  return NextResponse.json({
    booking: {
      reference: r.reference,
      court: court ? { id: court.id, name: court.name, sport: court.sport } : null,
      slot: slot ? { start_time: slot.start_time, end_time: slot.end_time } : null,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      customer_email: r.customer_email,
      notes: r.notes,
      total_price: Number(r.total_price),
      status: r.status,
      created_at: r.created_at,
    },
  });
}
