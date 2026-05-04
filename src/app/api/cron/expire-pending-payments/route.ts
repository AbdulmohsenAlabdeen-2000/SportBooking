import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Sweeps bookings stuck in `pending_payment` past their TTL. The MF
// webhook is the happy-path source of truth, but networks fail and
// customers abandon the payment page mid-flow — without this cron a
// dead booking would hold its slot forever.
//
// Schedule: hourly on Pro, once-daily on Hobby (set in vercel.json).
// The 15-minute TTL is generous enough that legit-but-slow customers
// don't get cancelled during their flow, but short enough that a
// released slot becomes bookable again the same hour.

const TTL_MS = 15 * 60 * 1000;

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) return jsonError("unauthorized", 401);

  const supabase = createServerClient();
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();

  // Pull the candidates first so we can release each slot in lockstep.
  const { data: stale, error } = await supabase
    .from("bookings")
    .select("id, reference, slot_id")
    .eq("status", "pending_payment")
    .lt("created_at", cutoff);
  if (error) return jsonError(error.message, 500);

  const rows = stale ?? [];
  let cancelled = 0;
  let slotErrors = 0;

  for (const row of rows) {
    const { error: updErr } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", row.id)
      .eq("status", "pending_payment"); // race-safe: only flip if still pending
    if (updErr) {
      console.error("[expire-pending] booking update failed", {
        reference: row.reference,
        error: updErr.message,
      });
      continue;
    }
    cancelled++;
    const { error: slotErr } = await supabase
      .from("slots")
      .update({ status: "open" })
      .eq("id", row.slot_id);
    if (slotErr) {
      slotErrors++;
      console.error("[expire-pending] slot release failed", {
        reference: row.reference,
        slot_id: row.slot_id,
        error: slotErr.message,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    cutoff,
    candidates: rows.length,
    cancelled,
    slot_errors: slotErrors,
  });
}
