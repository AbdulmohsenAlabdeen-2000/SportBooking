import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { isDemoMode } from "@/lib/demo/mode";
import { listAllBookings as demoListAll } from "@/lib/demo/store";
import type { BookingStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

// Lifetime revenue: sum of total_price across every confirmed/completed
// booking ever. Cancelled is excluded (refund issued); declined never
// counted (payment never went through).

export async function GET() {
  if (isDemoMode()) {
    const all = demoListAll();
    const revenue = all
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .reduce((sum, b) => sum + Number(b.total_price), 0);
    return NextResponse.json({ revenue_kwd: revenue });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select("total_price, status")
    .in("status", ["confirmed", "completed"]);

  if (error) return jsonError(error.message, 500);

  type Row = { total_price: number | string; status: BookingStatus };
  const revenue = ((data ?? []) as Row[]).reduce(
    (sum, r) => sum + Number(r.total_price),
    0,
  );

  return NextResponse.json({ revenue_kwd: revenue });
}
