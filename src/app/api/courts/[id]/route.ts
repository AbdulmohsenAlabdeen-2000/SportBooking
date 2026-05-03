import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";
import type { Court } from "@/lib/types";

export const dynamic = "force-dynamic";

const COURT_FIELDS =
  "id, name, sport, description, capacity, price_per_slot, slot_duration_minutes, image_url, is_active";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return jsonError("court_not_found", 404);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courts")
    .select(COURT_FIELDS)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data || !data.is_active) return jsonError("court_not_found", 404);

  const { is_active: _ignored, ...court } = data;
  return NextResponse.json({ court: court as Court });
}
