import type { Sport } from "@/lib/types";

export type CourtInput = {
  name: string;
  sport: Sport;
  description: string | null;
  capacity: number;
  price_per_slot: number;
  slot_duration_minutes: number;
  is_active: boolean;
};

export type ValidationFailure = { field: string; error: string };

const NAME_MIN = 2;
const NAME_MAX = 80;
const DESC_MAX = 500;
const SPORTS: ReadonlyArray<Sport> = ["padel", "tennis", "football"];
const ALLOWED_DURATIONS = [30, 45, 60, 90, 120] as const;

type RawInput = Partial<{
  name: unknown;
  sport: unknown;
  description: unknown;
  capacity: unknown;
  price_per_slot: unknown;
  slot_duration_minutes: unknown;
  is_active: unknown;
}>;

export function validateCourtInput(
  raw: unknown,
  { partial = false }: { partial?: boolean } = {},
):
  | { ok: true; value: Partial<CourtInput> }
  | { ok: false; failures: ValidationFailure[] } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, failures: [{ field: "_root", error: "body_required" }] };
  }
  const body = raw as RawInput;
  const failures: ValidationFailure[] = [];
  const value: Partial<CourtInput> = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      failures.push({ field: "name", error: "invalid_type" });
    } else {
      const name = body.name.trim();
      if (name.length < NAME_MIN || name.length > NAME_MAX) {
        failures.push({ field: "name", error: "invalid_length" });
      } else value.name = name;
    }
  } else if (!partial) {
    failures.push({ field: "name", error: "required" });
  }

  if (body.sport !== undefined) {
    if (typeof body.sport !== "string" || !SPORTS.includes(body.sport as Sport)) {
      failures.push({ field: "sport", error: "invalid_sport" });
    } else value.sport = body.sport as Sport;
  } else if (!partial) {
    failures.push({ field: "sport", error: "required" });
  }

  if (body.description !== undefined) {
    if (body.description === null || body.description === "") {
      value.description = null;
    } else if (typeof body.description !== "string") {
      failures.push({ field: "description", error: "invalid_type" });
    } else if (body.description.length > DESC_MAX) {
      failures.push({ field: "description", error: "too_long" });
    } else {
      value.description = body.description.trim() || null;
    }
  }

  if (body.capacity !== undefined) {
    const n = Number(body.capacity);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      failures.push({ field: "capacity", error: "invalid_capacity" });
    } else value.capacity = n;
  } else if (!partial) {
    failures.push({ field: "capacity", error: "required" });
  }

  if (body.price_per_slot !== undefined) {
    const n = Number(body.price_per_slot);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) {
      failures.push({ field: "price_per_slot", error: "invalid_price" });
    } else {
      value.price_per_slot = Math.round(n * 1000) / 1000;
    }
  } else if (!partial) {
    failures.push({ field: "price_per_slot", error: "required" });
  }

  if (body.slot_duration_minutes !== undefined) {
    const n = Number(body.slot_duration_minutes);
    if (!ALLOWED_DURATIONS.includes(n as (typeof ALLOWED_DURATIONS)[number])) {
      failures.push({
        field: "slot_duration_minutes",
        error: "invalid_duration",
      });
    } else value.slot_duration_minutes = n;
  } else if (!partial) {
    value.slot_duration_minutes = 60;
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean") {
      failures.push({ field: "is_active", error: "invalid_type" });
    } else value.is_active = body.is_active;
  } else if (!partial) {
    value.is_active = true;
  }

  if (failures.length > 0) return { ok: false, failures };
  return { ok: true, value };
}
