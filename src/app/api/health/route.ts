import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { error, count } = await supabase
      .from("courts")
      .select("*", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { ok: false, db: "error", error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      db: "up",
      courts: count ?? 0,
      time: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ ok: false, db: "down", error: message }, { status: 500 });
  }
}
