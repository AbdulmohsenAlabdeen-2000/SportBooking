// Concurrency test: fires 20 simultaneous POST /api/bookings against the same
// open slot. Expects exactly 1 success (201) and 19 conflicts (409). Rolls the
// slot back to `open` and deletes the test booking so the test is repeatable.
//
// Usage: `npm run test:concurrency` (requires `npm run dev` running on :3000)
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1. Find any open slot
  const { data: slot, error: slotErr } = await supabase
    .from('slots')
    .select('id, court_id, status')
    .eq('status', 'open')
    .limit(1)
    .maybeSingle();
  if (slotErr) throw slotErr;
  if (!slot) throw new Error('No open slots — re-run `npm run seed` first.');
  console.log(`Target slot: ${slot.id}`);

  // 2. Fire 20 concurrent POSTs
  const body = JSON.stringify({
    slot_id: slot.id,
    customer_name: 'Concurrency Test',
    customer_phone: '12345678',
  });

  const t0 = Date.now();
  const responses = await Promise.all(
    Array.from({ length: 20 }, () =>
      fetch(`${BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }),
    ),
  );
  const ms = Date.now() - t0;

  const statusCounts: Record<number, number> = {};
  for (const r of responses) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  console.log(`Status counts after ${ms}ms:`, statusCounts);

  const successes = statusCounts[201] ?? 0;
  const conflicts = statusCounts[409] ?? 0;

  // 3. Assert exactly 1 success and 19 conflicts
  if (successes !== 1) {
    throw new Error(`Expected 1 success, got ${successes}`);
  }
  if (conflicts !== 19) {
    throw new Error(`Expected 19 conflicts, got ${conflicts}`);
  }

  // 4. Assert DB state: slot is booked, exactly 1 booking row for it
  const { data: slotAfter } = await supabase
    .from('slots')
    .select('status')
    .eq('id', slot.id)
    .maybeSingle();
  if (slotAfter?.status !== 'booked') {
    throw new Error(`Expected slot.status='booked', got ${slotAfter?.status}`);
  }

  const { count: bookingCount } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('slot_id', slot.id);
  if (bookingCount !== 1) {
    throw new Error(`Expected 1 booking row for slot, got ${bookingCount}`);
  }

  console.log('PASS — 1 success, 19 conflicts, slot booked, 1 booking row');

  // 5. Cleanup so the test can be re-run
  await supabase.from('bookings').delete().eq('slot_id', slot.id);
  await supabase.from('slots').update({ status: 'open' }).eq('id', slot.id);
  console.log('Cleaned up test booking and reset slot to open');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
