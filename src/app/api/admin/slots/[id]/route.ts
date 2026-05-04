import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";
import { isDemoMode } from "@/lib/demo/mode";
import { setSlotStatus as demoSetSlot } from "@/lib/demo/store";
import type { SlotStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Patch = { status?: SlotStatus };

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) return jsonError("slot_not_found", 404);

  let body: Patch;
  try {
    body = (await req.json()) as Patch;
  } catch {
    return jsonError("invalid_json", 400);
  }

  if (body.status !== "open" && body.status !== "closed") {
    return jsonError("invalid_status", 400);
  }
  const target: SlotStatus = body.status;

  if (isDemoMode()) {
    const result = demoSetSlot(params.id, target);
    if (!result.ok) {
      const status = result.error === "slot_not_found" ? 404 : 409;
      return jsonError(result.error, status);
    }
    return NextResponse.json({ slot: result.slot });
  }

  const supabase = createServerClient();

  // Get current to give an exact 404 / 409.
  const { data: current, error: lookupErr } = await supabase
    .from("slots")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (lookupErr) return jsonError(lookupErr.message, 500);
  if (!current) return jsonError("slot_not_found", 404);

  if (current.status === "booked") {
    return jsonError("slot_booked", 409);
  }

  // Guard the update with a not-booked predicate so a concurrent booking
  // can't lose its slot to an open/close flip.
  const { data, error } = await supabase
    .from("slots")
    .update({ status: target })
    .eq("id", params.id)
    .neq("status", "booked")
    .select("id, court_id, start_time, end_time, status")
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("slot_booked", 409);

  return NextResponse.json({ slot: data });
}

// DELETE /api/admin/slots/[id] — hard-delete an unused slot. Allowed only
// when status != 'booked' and no bookings reference it. Used to remove
// custom slots that were added by mistake or to prune past slots.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) return jsonError("slot_not_found", 404);

  const supabase = createServerClient();

  const { data: current, error: lookupErr } = await supabase
    .from("slots")
    .select("id, status")
    .eq("id", params.id)
    .maybeSingle();
  if (lookupErr) return jsonError(lookupErr.message, 500);
  if (!current) return jsonError("slot_not_found", 404);
  if (current.status === "booked") return jsonError("slot_has_booking", 409);

  // Even a 'closed' or 'open' slot might have a historical booking row that
  // references it (e.g. a cancelled booking). The bookings.slot_id FK has no
  // cascade, so the delete would fail; pre-checking yields a clean 409.
  const { count, error: countErr } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", params.id);
  if (countErr) return jsonError(countErr.message, 500);
  if ((count ?? 0) > 0) return jsonError("slot_has_booking", 409);

  const { error: delErr } = await supabase
    .from("slots")
    .delete()
    .eq("id", params.id);
  if (delErr) return jsonError(delErr.message, 500);

  return NextResponse.json({ ok: true });
}
