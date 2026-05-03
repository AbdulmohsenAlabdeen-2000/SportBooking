import { NextResponse } from "next/server";
import { isValidIsoDate, isWithinBookingWindow } from "@/lib/time";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export type DateValidation =
  | { ok: true; date: string }
  | { ok: false; error: string; status: number };

export function validateDateParam(date: string | null): DateValidation {
  if (!date) {
    return { ok: false, error: "date_required", status: 400 };
  }
  if (!isValidIsoDate(date)) {
    return { ok: false, error: "date_invalid_format", status: 400 };
  }
  if (!isWithinBookingWindow(date)) {
    return { ok: false, error: "date_out_of_window", status: 400 };
  }
  return { ok: true, date };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}
