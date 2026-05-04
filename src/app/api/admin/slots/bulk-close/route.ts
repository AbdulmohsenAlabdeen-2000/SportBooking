import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";
import { isValidIsoDate, kuwaitDateToUtcRange } from "@/lib/time";
import { isDemoMode } from "@/lib/demo/mode";
import { bulkSetSlotsForDay as demoBulk } from "@/lib/demo/store";
import type { SlotStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = { court_id?: string; date?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("invalid_json", 400);
  }

  const courtId = body.court_id ?? "";
  const date = body.date ?? "";
  if (!isUuid(courtId)) return jsonError("invalid_court_id", 400);
  if (!isValidIsoDate(date)) return jsonError("invalid_date", 400);

  const { startUtc, endUtc } = kuwaitDateToUtcRange(date);

  if (isDemoMode()) {
    const result = demoBulk(courtId, startUtc, endUtc, "open", "closed");
    return NextResponse.json({ closed: result.changed, skipped: result.skipped });
  }

  const supabase = createServerClient();

  // Fetch the day's slots so we can report skipped (booked) ones.
  const { data: slots, error: fetchErr } = await supabase
    .from("slots")
    .select("id, start_time, status")
    .eq("court_id", courtId)
    .gte("start_time", startUtc)
    .lt("start_time", endUtc);
  if (fetchErr) return jsonError(fetchErr.message, 500);

  type Slot = { id: string; start_time: string; status: SlotStatus };
  const all = (slots ?? []) as Slot[];

  const openIds = all.filter((s) => s.status === "open").map((s) => s.id);
  const skipped = all
    .filter((s) => s.status === "booked")
    .map((s) => ({ id: s.id, start_time: s.start_time, reason: "already_booked" as const }));

  if (openIds.length === 0) {
    return NextResponse.json({ closed: 0, skipped });
  }

  const { error: updateErr, count } = await supabase
    .from("slots")
    .update({ status: "closed" }, { count: "exact" })
    .in("id", openIds)
    .eq("status", "open");
  if (updateErr) return jsonError(updateErr.message, 500);

  return NextResponse.json({ closed: count ?? 0, skipped });
}
