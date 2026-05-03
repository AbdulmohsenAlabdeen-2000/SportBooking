import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerClient();
    const [courtsRes, slotsRes] = await Promise.all([
      supabase.from("courts").select("*", { count: "exact", head: true }),
      supabase.from("slots").select("*", { count: "exact", head: true }),
    ]);

    if (courtsRes.error || slotsRes.error) {
      return NextResponse.json(
        {
          ok: false,
          db: "error",
          error: courtsRes.error?.message ?? slotsRes.error?.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      db: "up",
      courts: courtsRes.count ?? 0,
      slots: slotsRes.count ?? 0,
      time: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, db: "down", error: message }, { status: 500 });
  }
}
