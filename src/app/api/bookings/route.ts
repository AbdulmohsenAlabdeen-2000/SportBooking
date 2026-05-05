import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { createCookieClient } from "@/lib/supabase/route";
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
import { sendBookingConfirmationSms } from "@/lib/sms/booking-confirmation";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isSupportedLocale,
} from "@/lib/i18n/shared";
import {
  executePayment,
  isMyFatoorahConfigured,
} from "@/lib/payments/myfatoorah";

export const dynamic = "force-dynamic";

const MAX_REFERENCE_RETRIES = 3;
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function getBaseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

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

  const cookieLocale = cookies().get(LOCALE_COOKIE)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

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
      return jsonError(result.error, status); // includes slot_in_past
    }
    const slot = demoGetSlotById(result.booking.slot_id);
    const court = demoGetCourtById(result.booking.court_id);
    if (slot && court) {
      await sendBookingConfirmationSms({
        rawPhone: result.booking.customer_phone,
        customerName: result.booking.customer_name,
        courtName: court.name,
        startIso: slot.start_time,
        endIso: slot.end_time,
        reference: result.booking.reference,
        locale,
      });
    }
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
  // Reject slots whose start time is already in the past (Kuwait time
  // ≡ UTC for "is now after?" comparisons — both are absolute instants).
  if (new Date(slot.start_time).getTime() <= Date.now()) {
    return jsonError("slot_in_past", 409);
  }

  const { data: court, error: courtErr } = await supabase
    .from("courts")
    .select("id, name, sport, price_per_slot, is_active")
    .eq("id", slot.court_id)
    .maybeSingle();
  if (courtErr) return jsonError(courtErr.message, 500);
  if (!court || !court.is_active) return jsonError("court_not_found", 404);

  const paymentEnabled = isMyFatoorahConfigured();
  console.error("[bookings] payment env check", {
    has_api_key: !!process.env.MYFATOORAH_API_KEY,
    has_base_url: !!process.env.MYFATOORAH_BASE_URL,
    configured: paymentEnabled,
  });

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

      // Stamp locale + maybe link user_id. When MyFatoorah is enabled
      // we ALSO immediately move the booking to pending_payment so the
      // /me page and admin reflect that the slot is reserved but
      // unpaid.
      const updates: Record<string, string | null> = { locale };
      if (paymentEnabled) updates.status = "pending_payment";
      try {
        const cookieClient = createCookieClient();
        const { data: userResp } = await cookieClient.auth.getUser();
        const userId = userResp.user?.id;
        if (userId) updates.user_id = userId;
        await supabase
          .from("bookings")
          .update(updates)
          .eq("reference", row.reference);
      } catch {
        // Don't fail — row is in place.
      }

      // ─ If MyFatoorah isn't configured, behave like before: send SMS
      //   confirmation and return the booking immediately. This keeps
      //   dev / non-payment deployments working.
      if (!paymentEnabled) {
        await sendBookingConfirmationSms({
          rawPhone: row.customer_phone,
          customerName: row.customer_name,
          courtName: court.name,
          startIso: slot.start_time,
          endIso: slot.end_time,
          reference: row.reference,
          locale,
        });
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

      // ─ Payment flow — call MyFatoorah ExecutePayment and return the
      //   hosted-page URL. The webhook + landing page handle the rest.
      const baseUrl = getBaseUrl();
      const callbackUrl = `${baseUrl}/book/payment-result?reference=${encodeURIComponent(row.reference)}`;
      const errorUrl = `${baseUrl}/book/payment-result?reference=${encodeURIComponent(row.reference)}&failed=1`;

      const mf = await executePayment({
        invoiceAmount: Number(row.total_price),
        customerName: row.customer_name,
        customerEmail: input.customer_email ?? null,
        // MyFatoorah caps CustomerMobile at 11 chars — strip the leading "+"
        // from our canonical "+96512345678" so we send "96512345678".
        customerMobile: row.customer_phone.replace(/^\+/, ""),
        callbackUrl,
        errorUrl,
        customerReference: row.reference,
        language: locale,
      });

      if (!mf.ok) {
        // Couldn't initiate payment — release the slot so the customer
        // can try again, mark booking as cancelled.
        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("reference", row.reference);
        await supabase
          .from("slots")
          .update({ status: "open" })
          .eq("id", input.slot_id);
        console.error("[bookings] ExecutePayment failed", {
          reference: row.reference,
          error: mf.error,
        });
        return jsonError(`payment_init_failed:${mf.error}`, 502);
      }

      await supabase
        .from("bookings")
        .update({
          payment_invoice_id: String(mf.invoiceId),
          payment_url: mf.paymentUrl,
        })
        .eq("reference", row.reference);

      return NextResponse.json(
        {
          booking: {
            reference: row.reference,
            court: { id: court.id, name: court.name, sport: court.sport },
            slot: { start_time: slot.start_time, end_time: slot.end_time },
            customer_name: row.customer_name,
            customer_phone: row.customer_phone,
            total_price: Number(row.total_price),
            status: "pending_payment",
            created_at: row.created_at,
          },
          payment: {
            invoice_id: mf.invoiceId,
            payment_url: mf.paymentUrl,
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
