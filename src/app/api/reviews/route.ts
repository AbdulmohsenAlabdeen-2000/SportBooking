import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createCookieClient } from "@/lib/supabase/route";
import { jsonError, isUuid } from "@/lib/api";

export const dynamic = "force-dynamic";

const RATING_MIN = 1;
const RATING_MAX = 5;
const COMMENT_MAX = 500;

type Body = {
  booking_id?: string;
  rating?: number;
  comment?: string | null;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (!body.booking_id || !isUuid(body.booking_id)) {
    return jsonError("invalid_booking_id", 400);
  }
  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    return jsonError("invalid_rating", 400);
  }
  let comment: string | null = null;
  if (body.comment != null && body.comment !== "") {
    if (typeof body.comment !== "string") {
      return jsonError("invalid_comment", 400);
    }
    if (body.comment.length > COMMENT_MAX) {
      return jsonError("comment_too_long", 400);
    }
    comment = body.comment.trim() || null;
  }

  // Authenticated user.
  const cookieClient = createCookieClient();
  const { data: userResp } = await cookieClient.auth.getUser();
  const user = userResp.user;
  if (!user) return jsonError("unauthorized", 401);

  // Ownership + state checks via service role.
  const supabase = createServerClient();
  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .select("id, user_id, court_id, status, slot:slots(start_time)")
    .eq("id", body.booking_id)
    .maybeSingle();
  if (bookErr) return jsonError(bookErr.message, 500);
  if (!booking || booking.user_id !== user.id) {
    // Same 404 for "doesn't exist" and "not yours" — don't leak ids.
    return jsonError("booking_not_found", 404);
  }
  if (booking.status === "cancelled") {
    return jsonError("booking_cancelled", 409);
  }

  // Booking must have already started; reviewing a future slot makes
  // no sense.
  const slot = Array.isArray(booking.slot) ? booking.slot[0] : booking.slot;
  if (!slot || new Date(slot.start_time).getTime() > Date.now()) {
    return jsonError("booking_not_started", 409);
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      booking_id: booking.id,
      user_id: user.id,
      court_id: booking.court_id,
      rating,
      comment,
    })
    .select()
    .maybeSingle();

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return jsonError("already_reviewed", 409);
    }
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ review: data }, { status: 201 });
}
