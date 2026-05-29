/**
 * Stress test for Supabase Realtime.
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... CONNECTIONS=600 node node-realtime-stress.js
 *
 * Spawns CONNECTIONS subscriptions in parallel, each watching
 * `driver_locations` and `passenger_locations` like the real app does.
 * Logs the number of `SUBSCRIBED` vs `CHANNEL_ERROR`/`CLOSED` channels and
 * exits non-zero if more than 5% fail. Use this to validate Supabase tier
 * limits before going to production.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CONNECTIONS = Number(process.env.CONNECTIONS || 600);
const HOLD_MS = Number(process.env.HOLD_MS || 60_000);

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY are required.');
  process.exit(2);
}

const clients = [];
const statuses = { SUBSCRIBED: 0, CHANNEL_ERROR: 0, TIMED_OUT: 0, CLOSED: 0, OTHER: 0 };

async function spawn(i) {
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  clients.push(sb);

  const ch = sb.channel(`stress_${i}`);
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, () => {});
  ch.on('postgres_changes', { event: '*', schema: 'public', table: 'passenger_locations' }, () => {});

  ch.subscribe((status) => {
    if (statuses[status] != null) statuses[status]++;
    else statuses.OTHER++;
  });
}

async function main() {
  console.log(`Spawning ${CONNECTIONS} channels…`);
  const start = Date.now();
  for (let i = 0; i < CONNECTIONS; i++) {
    spawn(i);
    if (i % 100 === 0) await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`Spawned in ${Date.now() - start}ms. Holding for ${HOLD_MS / 1000}s…`);

  await new Promise((r) => setTimeout(r, HOLD_MS));
  console.log('Statuses:', statuses);
  const total = Object.values(statuses).reduce((a, b) => a + b, 0);
  const failed = statuses.CHANNEL_ERROR + statuses.TIMED_OUT + statuses.CLOSED;
  const pct = (failed / Math.max(total, 1)) * 100;
  console.log(`Failure rate: ${pct.toFixed(2)}%`);

  for (const c of clients) await c.removeAllChannels();

  process.exit(pct > 5 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
