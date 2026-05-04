// In-memory demo store. Lives only for the life of the Node process. Activates
// when the Supabase env vars are missing so the entire customer + admin flow is
// usable without any external setup.
//
// Importantly, this is NOT a Supabase shim. It exposes a small set of typed
// methods that the API routes call after `if (isDemoMode())` branches.
//
// Concurrency: Node's single-threaded event loop means no two ticks can race
// inside one method. The atomic-booking guarantee from create_booking() is
// preserved by reading + flipping the slot status synchronously inside
// createBooking() before yielding.

import { generateBookingReference } from "@/lib/reference";
import {
  KUWAIT_OFFSET_HOURS,
  BOOKING_WINDOW_DAYS,
  kuwaitTodayIso,
  nextNDaysIso,
} from "@/lib/time";
import type {
  Booking,
  BookingStatus,
  Court,
  Slot,
  SlotStatus,
  Sport,
} from "@/lib/types";

type StoredCourt = Court;
type StoredSlot = Slot;
type StoredBooking = Booking;

type Store = {
  courts: StoredCourt[];
  slots: StoredSlot[];
  bookings: StoredBooking[];
};

const SLOT_HOURS = Array.from({ length: 15 }, (_, i) => 8 + i); // 08:00–22:00 starts

function uuid(): string {
  // crypto.randomUUID is available in Node 19+ and the Edge runtime.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`;
}

function kuwaitDateAtHourToUtcIso(dateIso: string, hour: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hour - KUWAIT_OFFSET_HOURS, 0, 0, 0);
  return new Date(utcMs).toISOString();
}

function buildInitialStore(): Store {
  const COURT_SEEDS: Array<{
    name: string;
    sport: Sport;
    description: string;
    capacity: number;
    price_per_slot: number;
  }> = [
    {
      name: "Padel Court 1",
      sport: "padel",
      description: "Outdoor padel court with panoramic glass walls.",
      capacity: 4,
      price_per_slot: 8.0,
    },
    {
      name: "Padel Court 2",
      sport: "padel",
      description: "Covered padel court with LED lighting.",
      capacity: 4,
      price_per_slot: 8.0,
    },
    {
      name: "Tennis Court",
      sport: "tennis",
      description: "Hard-surface tennis court, ITF-spec lighting.",
      capacity: 4,
      price_per_slot: 6.0,
    },
    {
      name: "Football Pitch",
      sport: "football",
      description: "5-a-side artificial turf, full perimeter netting.",
      capacity: 10,
      price_per_slot: 15.0,
    },
  ];

  const courts: StoredCourt[] = COURT_SEEDS.map((c) => ({
    id: uuid(),
    name: c.name,
    sport: c.sport,
    description: c.description,
    capacity: c.capacity,
    price_per_slot: c.price_per_slot,
    slot_duration_minutes: 60,
    image_url: null,
  }));

  const days = nextNDaysIso(BOOKING_WINDOW_DAYS);
  const slots: StoredSlot[] = [];
  for (const court of courts) {
    for (const day of days) {
      for (const hour of SLOT_HOURS) {
        slots.push({
          id: uuid(),
          court_id: court.id,
          start_time: kuwaitDateAtHourToUtcIso(day, hour),
          end_time: kuwaitDateAtHourToUtcIso(day, hour + 1),
          status: "open",
        });
      }
    }
  }

  return { courts, slots, bookings: [] };
}

// Globally cache so HMR + multiple imports share one store.
const GLOBAL_KEY = "__SMASH_COURTS_DEMO_STORE__";
type GlobalWithStore = typeof globalThis & { [GLOBAL_KEY]?: Store };

function getStore(): Store {
  const g = globalThis as GlobalWithStore;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = buildInitialStore();
  return g[GLOBAL_KEY];
}

// ─── Read ───────────────────────────────────────────────────────────────────

export function listActiveCourts(): Court[] {
  return [...getStore().courts].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCourtById(id: string): Court | null {
  return getStore().courts.find((c) => c.id === id) ?? null;
}

export function listSlotsForCourtAndDate(
  courtId: string,
  startUtc: string,
  endUtc: string,
): Slot[] {
  return getStore()
    .slots.filter(
      (s) =>
        s.court_id === courtId && s.start_time >= startUtc && s.start_time < endUtc,
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

export function listSlotsInRange(
  courtId: string,
  startUtc: string,
  endUtc: string,
): Slot[] {
  return listSlotsForCourtAndDate(courtId, startUtc, endUtc);
}

export function listAllBookingsInRange(
  startUtc: string,
  endUtc: string,
): Booking[] {
  const slotIds = new Set(
    getStore()
      .slots.filter((s) => s.start_time >= startUtc && s.start_time < endUtc)
      .map((s) => s.id),
  );
  return getStore().bookings.filter((b) => slotIds.has(b.slot_id));
}

export function getBookingByReference(reference: string): Booking | null {
  return getStore().bookings.find((b) => b.reference === reference) ?? null;
}

export function getSlotById(id: string): Slot | null {
  return getStore().slots.find((s) => s.id === id) ?? null;
}

// ─── Write ──────────────────────────────────────────────────────────────────

export function createBooking(input: {
  slot_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
}): { ok: true; booking: Booking } | { ok: false; error: "slot_not_found" | "slot_not_available" | "court_not_found" } {
  const store = getStore();
  const slotIdx = store.slots.findIndex((s) => s.id === input.slot_id);
  if (slotIdx === -1) return { ok: false, error: "slot_not_found" };

  const slot = store.slots[slotIdx];
  if (slot.status !== "open") return { ok: false, error: "slot_not_available" };

  const court = store.courts.find((c) => c.id === slot.court_id);
  if (!court) return { ok: false, error: "court_not_found" };

  // Atomically flip slot to booked.
  store.slots[slotIdx] = { ...slot, status: "booked" };

  const booking: Booking = {
    id: uuid(),
    reference: generateBookingReference(),
    court_id: court.id,
    slot_id: slot.id,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    customer_email: input.customer_email,
    notes: input.notes,
    total_price: court.price_per_slot,
    status: "confirmed",
    created_at: new Date().toISOString(),
  };
  store.bookings.push(booking);
  return { ok: true, booking };
}

export function updateBookingStatus(
  reference: string,
  next: BookingStatus,
): { ok: true; booking: Booking } | { ok: false; error: "booking_not_found" | "already_finalized" } {
  const store = getStore();
  const idx = store.bookings.findIndex((b) => b.reference === reference);
  if (idx === -1) return { ok: false, error: "booking_not_found" };
  const current = store.bookings[idx];
  if (current.status !== "confirmed") {
    return { ok: false, error: "already_finalized" };
  }
  const updated: Booking = { ...current, status: next };
  store.bookings[idx] = updated;

  if (next === "cancelled") {
    const slotIdx = store.slots.findIndex((s) => s.id === current.slot_id);
    if (slotIdx >= 0) {
      store.slots[slotIdx] = { ...store.slots[slotIdx], status: "open" };
    }
  }
  return { ok: true, booking: updated };
}

export function setSlotStatus(
  id: string,
  next: SlotStatus,
): { ok: true; slot: Slot } | { ok: false; error: "slot_not_found" | "slot_booked" } {
  const store = getStore();
  const idx = store.slots.findIndex((s) => s.id === id);
  if (idx === -1) return { ok: false, error: "slot_not_found" };
  const current = store.slots[idx];
  if (current.status === "booked") return { ok: false, error: "slot_booked" };
  if (next === "booked") return { ok: false, error: "slot_booked" };
  store.slots[idx] = { ...current, status: next };
  return { ok: true, slot: store.slots[idx] };
}

export function bulkSetSlotsForDay(
  courtId: string,
  startUtc: string,
  endUtc: string,
  from: SlotStatus,
  to: SlotStatus,
): { changed: number; skipped: { id: string; start_time: string; reason: "already_booked" }[] } {
  const store = getStore();
  let changed = 0;
  const skipped: { id: string; start_time: string; reason: "already_booked" }[] = [];
  for (let i = 0; i < store.slots.length; i++) {
    const s = store.slots[i];
    if (
      s.court_id !== courtId ||
      s.start_time < startUtc ||
      s.start_time >= endUtc
    )
      continue;
    if (s.status === "booked") {
      skipped.push({ id: s.id, start_time: s.start_time, reason: "already_booked" });
      continue;
    }
    if (s.status === from) {
      store.slots[i] = { ...s, status: to };
      changed++;
    }
  }
  return { changed, skipped };
}

export function ensureSlotsForWindow(): { inserted: number } {
  const store = getStore();
  const days = nextNDaysIso(BOOKING_WINDOW_DAYS);
  const have = new Set(
    store.slots.map((s) => `${s.court_id}@${s.start_time}`),
  );
  let inserted = 0;
  for (const court of store.courts) {
    for (const day of days) {
      for (const hour of SLOT_HOURS) {
        const start = kuwaitDateAtHourToUtcIso(day, hour);
        const key = `${court.id}@${start}`;
        if (have.has(key)) continue;
        store.slots.push({
          id: uuid(),
          court_id: court.id,
          start_time: start,
          end_time: kuwaitDateAtHourToUtcIso(day, hour + 1),
          status: "open",
        });
        inserted++;
      }
    }
  }
  return { inserted };
}
