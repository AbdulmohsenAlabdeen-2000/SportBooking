import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid, validateDateParam } from "@/lib/api";
import { kuwaitDateToUtcRange } from "@/lib/time";
import { isDemoMode } from "@/lib/demo/mode";
import { getCourtById, listSlotsForCourtAndDate } from "@/lib/demo/store";
import type { Slot } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return jsonError("court_not_found", 404);

  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  const v = validateDateParam(dateParam);
  if (!v.ok) return jsonError(v.error, v.status);

  const { startUtc, endUtc } = kuwaitDateToUtcRange(v.date);

  // Stamp is_past at read time so the UI can render "Closed (past)"
  // without relying on a cron to flip statuses. The booking endpoint
  // also re-checks server-side, so the boolean here is a UX hint, not
  // a security boundary.
  const nowMs = Date.now();
  const stampPast = (s: Slot): Slot => ({
    ...s,
    is_past: new Date(s.start_time).getTime() <= nowMs,
  });

  if (isDemoMode()) {
    const court = getCourtById(params.id);
    if (!court) return jsonError("court_not_found", 404);
    const slots = listSlotsForCourtAndDate(params.id, startUtc, endUtc).map(
      stampPast,
    );
    return NextResponse.json({ slots });
  }

  const supabase = createServerClient();

  const { data: court, error: courtErr } = await supabase
    .from("courts")
    .select("id, is_active")
    .eq("id", params.id)
    .maybeSingle();
  if (courtErr) return jsonError(courtErr.message, 500);
  if (!court || !court.is_active) return jsonError("court_not_found", 404);

  const { data, error } = await supabase
    .from("slots")
    .select("id, start_time, end_time, status")
    .eq("court_id", params.id)
    .gte("start_time", startUtc)
    .lt("start_time", endUtc)
    .order("start_time", { ascending: true });

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ slots: ((data ?? []) as Slot[]).map(stampPast) });
}
