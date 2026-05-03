// Kuwait runs on Asia/Kuwait — UTC+3, no DST.
// Slots are stored as UTC timestamps representing Kuwait wall-clock hours.
// All date filtering converts a Kuwait calendar date (YYYY-MM-DD) to its
// UTC bounds: 00:00 Kuwait → 21:00 UTC the previous day.
export const KUWAIT_OFFSET_HOURS = 3;
export const BOOKING_WINDOW_DAYS = 14;

export function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function kuwaitTodayIso(): string {
  const now = new Date();
  const kuwait = new Date(now.getTime() + KUWAIT_OFFSET_HOURS * 3600 * 1000);
  return kuwait.toISOString().slice(0, 10);
}

export function kuwaitDateToUtcRange(dateIso: string): { startUtc: string; endUtc: string } {
  const [y, m, d] = dateIso.split("-").map(Number);
  const startUtcMs = Date.UTC(y, m - 1, d, -KUWAIT_OFFSET_HOURS, 0, 0, 0);
  const endUtcMs = startUtcMs + 24 * 3600 * 1000;
  return {
    startUtc: new Date(startUtcMs).toISOString(),
    endUtc: new Date(endUtcMs).toISOString(),
  };
}

export function isWithinBookingWindow(dateIso: string): boolean {
  const today = kuwaitTodayIso();
  const todayMs = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  const targetMs = Date.UTC(
    Number(dateIso.slice(0, 4)),
    Number(dateIso.slice(5, 7)) - 1,
    Number(dateIso.slice(8, 10)),
  );
  const diffDays = (targetMs - todayMs) / (24 * 3600 * 1000);
  return diffDays >= 0 && diffDays <= BOOKING_WINDOW_DAYS - 1;
}

export function nextNDaysIso(n: number): string[] {
  const today = kuwaitTodayIso();
  const baseMs = Date.UTC(
    Number(today.slice(0, 4)),
    Number(today.slice(5, 7)) - 1,
    Number(today.slice(8, 10)),
  );
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(baseMs + i * 24 * 3600 * 1000);
    return d.toISOString().slice(0, 10);
  });
}
