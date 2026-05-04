import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo/mode";
import { updateBookingStatus as demoUpdateStatus } from "@/lib/demo/store";
import type { BookingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const REFERENCE_RE = /^[A-Z]{2,4}-[A-Z0-9-]{4,30}$/;

const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

type Patch = { status?: BookingStatus };

export async function PATCH(
  req: Request,
  { params }: { params: { reference: string } },
) {
  const reference = params.reference;
  if (!REFERENCE_RE.test(reference)) return jsonError("booking_not_found", 404);

  let body: Patch;
  try {
    body = (await req.json()) as Patch;
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (body.status !== "completed" && body.status !== "cancelled") {
    return jsonError("invalid_status", 400);
  }
  const target: BookingStatus = body.status;

  if (isDemoMode()) {
    const result = demoUpdateStatus(reference, target);
    if (!result.ok) {
      const status = result.error === "booking_not_found" ? 404 : 409;
      return jsonError(result.error, status);
    }
    return NextResponse.json({ booking: result.booking });
  }

  const supabase = createServerClient();

  // Read current state to give precise 404 / 409 responses.
  const { data: current, error: lookupErr } = await supabase
    .from("bookings")
    .select("reference, status, slot_id")
    .eq("reference", reference)
    .maybeSingle();
  if (lookupErr) return jsonError(lookupErr.message, 500);
  if (!current) return jsonError("booking_not_found", 404);

  if (!ALLOWED_TRANSITIONS[current.status as BookingStatus].includes(target)) {
    return jsonError("already_finalized", 409);
  }

  if (target === "cancelled") {
    // RPC frees the slot atomically.
    const { data, error } = await supabase.rpc("cancel_booking", {
      p_reference: reference,
    });
    if (error) {
      if (error.message.includes("booking_not_cancellable")) {
        return jsonError("already_finalized", 409);
      }
      return jsonError(error.message, 500);
    }
    return NextResponse.json({ booking: data });
  }

  // target === 'completed': simple status flip; the slot stays booked.
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("reference", reference)
    .eq("status", "confirmed")
    .select()
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("already_finalized", 409);

  return NextResponse.json({ booking: data });
}
