import { isUuid } from "@/lib/api";
import { normalizeKuwaitPhone } from "@/lib/phone";

export type BookingInput = {
  slot_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
};

export type ValidationFailure = { field: string; error: string };

const NAME_MIN = 2;
const NAME_MAX = 80;
const NOTES_MAX = 500;
const EMAIL_MAX = 254;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateBookingInput(
  raw: unknown,
): { ok: true; value: BookingInput } | { ok: false; failures: ValidationFailure[] } {
  const failures: ValidationFailure[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, failures: [{ field: "_root", error: "body_required" }] };
  }
  const body = raw as Record<string, unknown>;

  const slot_id = typeof body.slot_id === "string" ? body.slot_id : "";
  if (!slot_id) failures.push({ field: "slot_id", error: "required" });
  else if (!isUuid(slot_id)) failures.push({ field: "slot_id", error: "invalid_uuid" });

  const customer_name = typeof body.customer_name === "string" ? body.customer_name.trim() : "";
  if (!customer_name) failures.push({ field: "customer_name", error: "required" });
  else if (customer_name.length < NAME_MIN || customer_name.length > NAME_MAX) {
    failures.push({ field: "customer_name", error: "invalid_length" });
  }

  let normalizedPhone = "";
  const phoneRaw = typeof body.customer_phone === "string" ? body.customer_phone : "";
  if (!phoneRaw.trim()) {
    failures.push({ field: "customer_phone", error: "required" });
  } else {
    const result = normalizeKuwaitPhone(phoneRaw);
    if (!result.ok) {
      failures.push({ field: "customer_phone", error: result.error });
    } else {
      normalizedPhone = result.value;
    }
  }

  let customer_email: string | null = null;
  if (body.customer_email != null && body.customer_email !== "") {
    if (typeof body.customer_email !== "string") {
      failures.push({ field: "customer_email", error: "invalid_type" });
    } else {
      const email = body.customer_email.trim();
      if (email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
        failures.push({ field: "customer_email", error: "invalid_email" });
      } else {
        customer_email = email;
      }
    }
  }

  let notes: string | null = null;
  if (body.notes != null && body.notes !== "") {
    if (typeof body.notes !== "string") {
      failures.push({ field: "notes", error: "invalid_type" });
    } else if (body.notes.length > NOTES_MAX) {
      failures.push({ field: "notes", error: "too_long" });
    } else {
      notes = body.notes.trim() || null;
    }
  }

  if (failures.length > 0) return { ok: false, failures };

  return {
    ok: true,
    value: {
      slot_id,
      customer_name,
      customer_phone: normalizedPhone,
      customer_email,
      notes,
    },
  };
}
