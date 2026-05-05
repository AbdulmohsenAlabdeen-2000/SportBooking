import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { jsonError, isUuid } from "@/lib/api";
import {
  isValidIsoDate,
  kuwaitDateToUtcRange,
  kuwaitTodayIso,
} from "@/lib/time";
import { isDemoMode } from "@/lib/demo/mode";
import {
  getCourtById as demoGetCourt,
  getSlotById as demoGetSlot,
  listAllBookingsInRange as demoBookingsInRange,
} from "@/lib/demo/store";
import type { BookingStatus, Sport } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: ReadonlyArray<BookingStatus | "all"> = [
  "all",
  "confirmed",
  "completed",
  "cancelled",
];

const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function plusDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

type Row = {
  reference: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  total_price: number | string;
  status: BookingStatus;
  created_at: string;
  notes: string | null;
  court: { id: string; name: string; sport: Sport } | { id: string; name: string; sport: Sport }[] | null;
  slot: { start_time: string; end_time: string } | { start_time: string; end_time: string }[] | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const courtParam = url.searchParams.get("court_id");
  const statusParam = (url.searchParams.get("status") ?? "all") as
    | BookingStatus
    | "all";
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const requestedSize = Number(
    url.searchParams.get("pageSize") ?? `${DEFAULT_PAGE_SIZE}`,
  );
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isFinite(requestedSize) ? requestedSize : DEFAULT_PAGE_SIZE),
  );

  const from = fromParam && isValidIsoDate(fromParam) ? fromParam : kuwaitTodayIso();
  const to =
    toParam && isValidIsoDate(toParam)
      ? toParam
      : plusDaysIso(from, DEFAULT_RANGE_DAYS);

  if (!STATUSES.includes(statusParam)) return jsonError("invalid_status", 400);
  if (courtParam && !isUuid(courtParam)) return jsonError("invalid_court_id", 400);

  const startUtc = kuwaitDateToUtcRange(from).startUtc;
  const endUtc = kuwaitDateToUtcRange(to).endUtc;

  if (isDemoMode()) {
    let rows = demoBookingsInRange(startUtc, endUtc);
    // Declined attempts (payment never completed) are not real bookings.
    rows = rows.filter((r) => r.status !== "declined");
    if (statusParam !== "all") rows = rows.filter((r) => r.status === statusParam);
    if (courtParam) rows = rows.filter((r) => r.court_id === courtParam);
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(needle) ||
          r.customer_name.toLowerCase().includes(needle) ||
          r.customer_phone.toLowerCase().includes(needle),
      );
    }
    rows.sort((a, b) => {
      const sa = demoGetSlot(a.slot_id)?.start_time ?? "";
      const sb = demoGetSlot(b.slot_id)?.start_time ?? "";
      return sb.localeCompare(sa);
    });
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const fromIdx = (page - 1) * pageSize;
    const slice = rows.slice(fromIdx, fromIdx + pageSize);
    const bookings = slice.map((r) => {
      const court = demoGetCourt(r.court_id);
      const slot = demoGetSlot(r.slot_id);
      return {
        reference: r.reference,
        court: court ? { id: court.id, name: court.name, sport: court.sport } : null,
        slot: slot ? { start_time: slot.start_time, end_time: slot.end_time } : null,
        customer_name: r.customer_name,
        customer_phone: r.customer_phone,
        customer_email: r.customer_email,
        notes: r.notes,
        total_price: r.total_price,
        status: r.status,
        created_at: r.created_at,
      };
    });
    return NextResponse.json({
      bookings,
      pagination: { page, pageSize, total, totalPages },
      filters: { from, to, court_id: courtParam, status: statusParam, q },
    });
  }

  const supabase = createServerClient();
  let query = supabase
    .from("bookings")
    .select(
      `
      reference,
      customer_name,
      customer_phone,
      customer_email,
      notes,
      total_price,
      status,
      created_at,
      court:courts(id, name, sport),
      slot:slots!inner(start_time, end_time)
    `,
      { count: "exact" },
    )
    .gte("slot.start_time", startUtc)
    .lt("slot.start_time", endUtc)
    .order("start_time", { foreignTable: "slot", ascending: false })
    .order("created_at", { ascending: false });

  // Declined attempts (payment never completed) are not real bookings.
  query = query.neq("status", "declined");
  if (statusParam !== "all") query = query.eq("status", statusParam);
  if (courtParam) query = query.eq("court_id", courtParam);
  if (q) {
    const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
    query = query.or(
      `reference.ilike.%${escaped}%,customer_name.ilike.%${escaped}%,customer_phone.ilike.%${escaped}%`,
    );
  }

  const fromIdx = (page - 1) * pageSize;
  const toIdx = fromIdx + pageSize - 1;
  query = query.range(fromIdx, toIdx);

  const { data, error, count } = await query;
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
      customer_email: r.customer_email,
      notes: r.notes,
      total_price: Number(r.total_price),
      status: r.status,
      created_at: r.created_at,
    };
  });

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return NextResponse.json({
    bookings,
    pagination: { page, pageSize, total, totalPages },
    filters: { from, to, court_id: courtParam, status: statusParam, q },
  });
}
