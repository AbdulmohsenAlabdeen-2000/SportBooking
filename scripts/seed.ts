import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type CourtSeed = {
  name: string;
  sport: 'padel' | 'tennis' | 'football';
  description: string;
  capacity: number;
  price_per_slot: number;
};

const COURTS: CourtSeed[] = [
  { name: 'Padel Court 1', sport: 'padel', description: 'Premium padel court with glass walls and turf flooring.', capacity: 4, price_per_slot: 8.0 },
  { name: 'Padel Court 2', sport: 'padel', description: 'Premium padel court with glass walls and turf flooring.', capacity: 4, price_per_slot: 8.0 },
  { name: 'Tennis Court', sport: 'tennis', description: 'Hard-court tennis with floodlights for night play.', capacity: 4, price_per_slot: 6.0 },
  { name: 'Football Pitch', sport: 'football', description: 'Five-a-side artificial turf pitch.', capacity: 10, price_per_slot: 15.0 },
];

const KUWAIT_OFFSET_HOURS = 3; // UTC+3, no DST
const SLOT_HOURS = Array.from({ length: 15 }, (_, i) => 8 + i); // 8..22
const DAYS_AHEAD = 14;

function kuwaitDateAtHourToUtcIso(date: Date, hour: number): string {
  // Convert "this calendar date in Kuwait at <hour>:00" to a UTC ISO string.
  const utcMs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour - KUWAIT_OFFSET_HOURS, 0, 0, 0);
  return new Date(utcMs).toISOString();
}

function kuwaitToday(): Date {
  const now = new Date();
  // Shift to Kuwait wall clock by adding offset, then strip time
  const kuwaitNow = new Date(now.getTime() + KUWAIT_OFFSET_HOURS * 60 * 60 * 1000);
  return new Date(Date.UTC(kuwaitNow.getUTCFullYear(), kuwaitNow.getUTCMonth(), kuwaitNow.getUTCDate()));
}

async function seed() {
  // 1. Insert courts (idempotent by name)
  const { data: existingCourts, error: existingErr } = await supabase
    .from('courts')
    .select('id, name');
  if (existingErr) throw existingErr;
  const existingByName = new Map((existingCourts ?? []).map((c) => [c.name, c.id]));

  const toInsert = COURTS.filter((c) => !existingByName.has(c.name));
  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('courts')
      .insert(toInsert)
      .select('id, name');
    if (insertErr) throw insertErr;
    for (const row of inserted ?? []) existingByName.set(row.name, row.id);
  }

  // 2. Build slots for next 14 days
  const today = kuwaitToday();
  const slots: { court_id: string; start_time: string; end_time: string }[] = [];

  for (const seedCourt of COURTS) {
    const courtId = existingByName.get(seedCourt.name)!;
    for (let dayOffset = 0; dayOffset < DAYS_AHEAD; dayOffset++) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() + dayOffset);
      for (const hour of SLOT_HOURS) {
        slots.push({
          court_id: courtId,
          start_time: kuwaitDateAtHourToUtcIso(day, hour),
          end_time: kuwaitDateAtHourToUtcIso(day, hour + 1),
        });
      }
    }
  }

  // 3. Upsert slots — onConflict on (court_id, start_time) makes this idempotent
  // Insert in chunks to avoid payload limits
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < slots.length; i += CHUNK) {
    const chunk = slots.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('slots')
      .upsert(chunk, { onConflict: 'court_id,start_time', ignoreDuplicates: true });
    if (error) throw error;
    inserted += chunk.length;
  }

  // 4. Final counts
  const [{ count: courtCount }, { count: slotCount }] = await Promise.all([
    supabase.from('courts').select('id', { count: 'exact', head: true }).then((r) => r),
    supabase.from('slots').select('id', { count: 'exact', head: true }).then((r) => r),
  ]);

  console.log(`Seeded ${courtCount ?? 0} courts and ${slotCount ?? 0} slots`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
