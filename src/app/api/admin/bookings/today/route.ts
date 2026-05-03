import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api";
import { kuwaitDateToUtcRange, kuwaitTodayIso } from "@/lib/time";
import type { BookingStatus, Sport } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = {
  reference: string;
  customer_name: string;
  customer_phone: string;
  total_price: number | string;
  status: BookingStatus;
  created_at: string;
  court: { id: string; name: string; sport: Sport } | { id: string; name: string; sport: Sport }[] | null;
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[] | null;
};

export async function GET() {
  const today = kuwaitTodayIso();
  const { startUtc, endUtc } = kuwaitDateToUtcRange(today);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
      reference,
      customer_name,
      customer_phone,
      total_price,
      status,
      created_at,
      court:courts(id, name, sport),
      slot:slots!inner(start_time, end_time)
    `,
    )
    .gte("slot.start_time", startUtc)
    .lt("slot.start_time", endUtc)
    .order("start_time", { foreignTable: "slot", ascending: true });

  if (error) return jsonError(error.message, 500);

  const rows = (data ?? []) as Row[];
  const bookings = rows.map((r) => {
    const court = Array.isArray(r.court) ? r.court[0] : r.court;
    const slot = Array.isArray(r.slot) ? r.slot[0] : r.slot;
    return {
      reference: r.reference,
      court: court ? { id: court.id, name: court.name, sport: court.sport } : null,
      slot: slot ? { start_time: slot.start_time, end_time: slot.end_time } : null,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      total_price: Number(r.total_price),
      status: r.status,
      created_at: r.created_at,
    };
  });

  const stats = {
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    revenue_kwd: bookings
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .reduce((sum, b) => sum + b.total_price, 0),
  };

  return NextResponse.json({ date: today, bookings, stats });
}
