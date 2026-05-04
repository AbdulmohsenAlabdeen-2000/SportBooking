import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";
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
