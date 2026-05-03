import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import type { Court } from "@/lib/types";

export const dynamic = "force-dynamic";

const COURT_FIELDS =
  "id, name, sport, description, capacity, price_per_slot, slot_duration_minutes, image_url";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courts")
    .select(COURT_FIELDS)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ courts: (data ?? []) as Court[] });
}
