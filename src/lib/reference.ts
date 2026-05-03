// Booking reference: BK-YYYY-XXXXX where XXXXX is 5 uppercase alphanumeric
// chars from a confusion-free alphabet (no I, O, 0, 1) so staff can read
// references back to customers over the phone without ambiguity.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomChunk(len: number): string {
  let out = "";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}

export function generateBookingReference(now: Date = new Date()): string {
  return `BK-${now.getUTCFullYear()}-${randomChunk(5)}`;
}
