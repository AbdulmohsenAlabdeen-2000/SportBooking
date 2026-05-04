import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";
import { validateCourtInput } from "@/lib/court";
import type { Court } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) return jsonError("court_not_found", 404);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courts")
    .select(
      "id, name, sport, description, capacity, price_per_slot, slot_duration_minutes, image_url, is_active, created_at",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("court_not_found", 404);
  return NextResponse.json({ court: data as Court });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) return jsonError("court_not_found", 404);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("invalid_json", 400);
  }

  const parsed = validateCourtInput(raw, { partial: true });
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.failures },
      { status: 400 },
    );
  }
  if (Object.keys(parsed.value).length === 0) {
    return jsonError("nothing_to_update", 400);
  }

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("courts")
    .update(parsed.value)
    .eq("id", params.id)
    .select()
    .maybeSingle();

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return jsonError("name_taken", 409);
    }
    return jsonError(error.message, 500);
  }
  if (!data) return jsonError("court_not_found", 404);

  return NextResponse.json({ court: data as Court });
}

// Soft-delete — flips is_active=false. Hard-deleting a court is impossible
// once any booking references it (the bookings.court_id FK has no
// on-delete cascade), so soft is the only safe story. Slots stay in place;
// they're just invisible to /api/courts and friends.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) return jsonError("court_not_found", 404);
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("courts")
    .update({ is_active: false })
    .eq("id", params.id)
    .select()
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("court_not_found", 404);
  return NextResponse.json({ court: data as Court });
}
