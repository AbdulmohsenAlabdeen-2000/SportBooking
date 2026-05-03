// Kuwait phone normalizer.
// Accepts: "12345678", "+96512345678", "+965 1234 5678", "965-12345678", "00965 1234 5678"
// Returns canonical "+96512345678" or an error code.

export type PhoneResult = { ok: true; value: string } | { ok: false; error: string };

export function normalizeKuwaitPhone(input: string): PhoneResult {
  if (typeof input !== "string") return { ok: false, error: "phone_invalid" };

  let digits = input.replace(/\D/g, "");
  if (digits.length === 0) return { ok: false, error: "phone_required" };

  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("965") && digits.length === 11) digits = digits.slice(3);

  if (digits.length !== 8) return { ok: false, error: "phone_invalid_length" };
  if (!/^[0-9]{8}$/.test(digits)) return { ok: false, error: "phone_invalid" };

  return { ok: true, value: `+965${digits}` };
}
