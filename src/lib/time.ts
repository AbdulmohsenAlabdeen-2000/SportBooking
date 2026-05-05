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

// ─── Display formatters ─────────────────────────────────────────────────────
// All formatters render in Asia/Kuwait so customers always see local wall-clock
// times regardless of where they're loading the page from.

const KUWAIT_TZ = "Asia/Kuwait";

export function formatKuwaitWeekday(dateIso: string): string {
  // dateIso = "YYYY-MM-DD". Anchor at noon UTC to avoid edge-case rollovers.
  const d = new Date(`${dateIso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    timeZone: KUWAIT_TZ,
  }).format(d);
}

export function formatKuwaitDayOfMonth(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    timeZone: KUWAIT_TZ,
  }).format(d);
}

export function formatKuwaitFullDate(dateIso: string): string {
  // "Sunday, 03 May 2026"
  const d = new Date(`${dateIso}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: KUWAIT_TZ,
  }).format(d);
}

export function formatKuwaitClock(isoTimestamp: string): string {
  // "10:00" — 24-hour Kuwait wall clock.
  const d = new Date(isoTimestamp);
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: KUWAIT_TZ,
  }).format(d);
}

export function formatKuwaitTimeRange(startIso: string, endIso: string): string {
  return `${formatKuwaitClock(startIso)} – ${formatKuwaitClock(endIso)}`;
}

export function formatKwd(amount: number): string {
  return `${amount.toFixed(3)} KWD`;
}

// Matches a trailing timezone designator on an ISO-like timestamp:
// either a literal Z (UTC) or a numeric offset like +03:00 / -0530.
const TIMEZONE_SUFFIX_RE = /(Z|[+-]\d{2}:?\d{2})$/;

const MONTH_NAMES_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatKuwaitDateTime(isoTimestamp: string): string {
  // "05 May 2026, 14:23:18 (GMT+3)" — receipt-style.
  //
  // Two input shapes to handle:
  //
  // 1. ISO timestamp with timezone (`...Z` or `...+03:00`). Treat as a
  //    real instant and project into Kuwait via Intl.
  //
  // 2. Naive timestamp with no timezone suffix (e.g. MyFatoorah returns
  //    `"2026-05-05T14:23:18"` already in Kuwait wall-clock time). We
  //    can't pass these through `new Date(...)` + Intl — JS parses them
  //    as UTC on Vercel, and the tz conversion would add 3 hours we
  //    don't want. Instead, parse the wall-clock parts and render them
  //    directly.
  if (!TIMEZONE_SUFFIX_RE.test(isoTimestamp)) {
    const m = isoTimestamp.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/,
    );
    if (m) {
      const [, year, month, day, hh, mm, ss = "00"] = m;
      const monthName = MONTH_NAMES_SHORT[parseInt(month, 10) - 1] ?? month;
      return `${day} ${monthName} ${year}, ${hh}:${mm}:${ss} (GMT+3)`;
    }
    // Unparseable — fall through and let Date/Intl do its best.
  }

  const d = new Date(isoTimestamp);
  const datePart = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: KUWAIT_TZ,
  }).format(d);
  const timePart = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: KUWAIT_TZ,
  }).format(d);
  return `${datePart}, ${timePart} (GMT+3)`;
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
