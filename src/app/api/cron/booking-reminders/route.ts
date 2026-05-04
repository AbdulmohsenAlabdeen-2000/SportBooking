import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { sendBookingReminderSms } from "@/lib/sms/booking-reminder";
import { isSupportedLocale, type Locale } from "@/lib/i18n/shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` with each
// invocation. Same shared-secret pattern as /api/cron/ensure-slots.
function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

// Window: bookings whose slot starts between 18h and 42h from now.
// The cron is scheduled daily at 06:00 UTC (09:00 Kuwait). Firing at
// that time, "18-42 hours from now" covers every booking on tomorrow's
// Kuwait calendar (courts run 08:00–22:00 KW) with a couple hours of
// slack on either edge. The reminded_at column dedupes anything that
// gets picked up twice across consecutive runs.
const WINDOW_START_OFFSET_MS = 18 * 60 * 60 * 1000;
const WINDOW_END_OFFSET_MS = 42 * 60 * 60 * 1000;

type Row = {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string;
  locale: string;
  status: string;
  court: { name: string } | { name: string }[] | null;
  slot:
    | { start_time: string; end_time: string }
    | { start_time: string; end_time: string }[]
    | null;
};

export async function GET(req: Request) {
  if (!isAuthorized(req)) return jsonError("unauthorized", 401);

  const supabase = createServerClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() + WINDOW_START_OFFSET_MS);
  const windowEnd = new Date(now.getTime() + WINDOW_END_OFFSET_MS);

  // Pull bookings whose slot starts inside the reminder window. Joining
  // `slots` lets us range-filter on start_time directly. The
  // `reminded_at is null` filter keeps prior runs from re-firing.
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      id,
      reference,
      customer_name,
      customer_phone,
      locale,
      status,
      court:courts!inner(name),
      slot:slots!inner(start_time, end_time)
    `,
    )
    .eq("status", "confirmed")
    .is("reminded_at", null)
    .gte("slot.start_time", windowStart.toISOString())
    .lte("slot.start_time", windowEnd.toISOString());

  if (error) {
    if (error.message.toLowerCase().includes("does not exist")) {
      // The migration hasn't been run yet — fail soft so cron retries
      // don't pile up on a hard error.
      return NextResponse.json({
        ok: false,
        reason: "schema_missing",
        sent: 0,
        failed: 0,
        skipped: 0,
      });
    }
    return jsonError(error.message, 500);
  }

  const rows = (data ?? []) as Row[];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const failures: { reference: string; error: string }[] = [];

  for (const row of rows) {
    const court = Array.isArray(row.court) ? row.court[0] : row.court;
    const slot = Array.isArray(row.slot) ? row.slot[0] : row.slot;
    if (!court || !slot) {
      skipped++;
      continue;
    }
    const locale: Locale = isSupportedLocale(row.locale) ? row.locale : "en";

    const result = await sendBookingReminderSms({
      rawPhone: row.customer_phone,
      customerName: row.customer_name,
      courtName: court.name,
      startIso: slot.start_time,
      endIso: slot.end_time,
      reference: row.reference,
      locale,
    });

    // Stamp reminded_at regardless of outcome — single-shot policy. A
    // permanent Twilio rejection (bad number, trial limit) shouldn't
    // re-fire next hour and waste credits; an admin can clear the
    // column manually to retry if needed.
    const { error: updErr } = await supabase
      .from("bookings")
      .update({ reminded_at: new Date().toISOString() })
      .eq("id", row.id);
    if (updErr) {
      console.error("[reminders] failed to stamp reminded_at", {
        reference: row.reference,
        error: updErr.message,
      });
    }

    if (result.ok) {
      sent++;
      console.log("[reminders] sent", {
        reference: row.reference,
        sid: result.sid,
      });
    } else {
      failed++;
      failures.push({ reference: row.reference, error: result.error });
      console.error("[reminders] send failed", {
        reference: row.reference,
        error: result.error,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    window: {
      start: windowStart.toISOString(),
      end: windowEnd.toISOString(),
    },
    candidates: rows.length,
    sent,
    failed,
    skipped,
    failures,
  });
}
