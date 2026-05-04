import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";

export const dynamic = "force-dynamic";

// GET /api/courts/[id]/reviews — public aggregate + recent reviews
// for display. PostgREST can't follow reviews.user_id → customers
// directly (no FK between them — both reference auth.users), so we
// fetch in two steps and merge in JS.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!isUuid(params.id)) return jsonError("court_not_found", 404);
  const supabase = createServerClient();

  const { data: rows, error } = await supabase
    .from("reviews")
    .select("id, user_id, rating, comment, created_at")
    .eq("court_id", params.id)
    .order("created_at", { ascending: false });
  if (error) return jsonError(error.message, 500);

  const all = rows ?? [];
  const count = all.length;
  const average =
    count > 0
      ? Math.round(
          (all.reduce((s, r) => s + r.rating, 0) / count) * 10,
        ) / 10
      : null;

  // Look up author names in one query for the most recent 10.
  const recent = all.slice(0, 10);
  const userIds = Array.from(new Set(recent.map((r) => r.user_id)));
  const namesById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: customers } = await supabase
      .from("customers")
      .select("user_id, name")
      .in("user_id", userIds);
    for (const c of customers ?? []) namesById.set(c.user_id, c.name);
  }

  const reviews = recent.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    author_name: namesById.get(r.user_id) ?? "A customer",
  }));

  return NextResponse.json({
    summary: { count, average },
    reviews,
  });
}
