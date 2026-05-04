// Manually trigger the booking-reminders cron on prod (or any env you
// point it at). Reads CRON_SECRET from .env.local so you don't have
// to handle the secret yourself.
//
// Usage:
//   node --env-file=.env.local scripts/trigger-reminders.mjs
//   node --env-file=.env.local scripts/trigger-reminders.mjs https://your-domain.com
//
// Defaults to the production Vercel URL when no argument is given.

const DEFAULT_BASE = "https://sport-booking-pi.vercel.app";

const base = process.argv[2]?.replace(/\/$/, "") ?? DEFAULT_BASE;
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error("Missing CRON_SECRET in .env.local");
  process.exit(1);
}

const url = `${base}/api/cron/booking-reminders`;
console.log(`POST ${url}`);

const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
});

console.log(`HTTP ${res.status}`);
const text = await res.text();
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text);
}
