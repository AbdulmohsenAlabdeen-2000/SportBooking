import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createCookieClient } from "@/lib/supabase/route";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";

const REFERENCE_RE = /^[A-Z]{2,4}-[A-Z0-9-]{4,30}$/;

// Customer self-service cancel. Only the booking's owner can cancel.
// Internally calls the same cancel_booking RPC that the admin uses, which
// flips the booking → cancelled and frees the slot → open atomically.
export async function POST(
  _req: Request,
  { params }: { params: { reference: string } },
) {
  const reference = params.reference;
  if (!REFERENCE_RE.test(reference)) return jsonError("booking_not_found", 404);

  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) return jsonError("unauthorized", 401);

  const supabase = createServerClient();

  // Confirm ownership before doing anything destructive. We give the same
  // 404 for "doesn't exist" and "not yours" so we don't leak the existence
  // of references to other users.
  const { data: booking, error: lookupErr } = await supabase
    .from("bookings")
    .select("reference, status, user_id")
    .eq("reference", reference)
    .maybeSingle();
  if (lookupErr) return jsonError(lookupErr.message, 500);
  if (!booking || booking.user_id !== user.id) {
    return jsonError("booking_not_found", 404);
  }
  if (booking.status !== "confirmed") {
    return jsonError("already_finalized", 409);
  }

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
