import { getOrCreateDeviceId } from '@/services/passengerProfile';
import {
  ensurePassengerProfileExists,
  getSupabaseDeviceId,
  supabase,
} from '@/services/supabase';

async function check(name, fn) {
  try {
    const detail = await fn();
    return { name, ok: true, detail };
  } catch (e) {
    return { name, ok: false, detail: e?.message ?? String(e) };
  }
}

/**
 * In-app Supabase / RLS health checks (Profile → App Diagnostics).
 */
export async function runSupabaseDiagnostics() {
  const deviceId = getSupabaseDeviceId() || (await getOrCreateDeviceId());
  const checks = [];

  checks.push(
    await check('Active trips readable', async () => {
      const { error } = await supabase
        .from('trips')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'full']);
      if (error) throw new Error(error.message);
      return 'OK';
    }),
  );

  checks.push(
    await check('Driver locations readable', async () => {
      const { data, error } = await supabase.from('driver_locations').select('mate_id').limit(1);
      if (error) throw new Error(error.message);
      return `${data?.length ?? 0} on map`;
    }),
  );

  checks.push(
    await check('Passenger profile (RLS + x-device-id)', async () => {
      const ensured = await ensurePassengerProfileExists(deviceId);
      if (!ensured.ok) throw new Error(ensured.error?.message ?? 'Profile save failed');
      return 'saved';
    }),
  );

  checks.push(
    await check('Passenger location queue', async () => {
      const { error } = await supabase.from('passenger_locations').upsert(
        {
          passenger_id: deviceId,
          latitude: 6.673,
          longitude: -1.565,
          queued_route: 'Diagnostics ping',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'passenger_id' },
      );
      if (error) throw new Error(error.message);
      return 'OK';
    }),
  );

  checks.push(
    await check('Mate ride invites (table)', async () => {
      const { error } = await supabase
        .from('mate_ride_requests')
        .select('id')
        .eq('passenger_id', deviceId)
        .eq('status', 'pending')
        .limit(1);
      if (error) throw new Error(error.message);
      return 'OK';
    }),
  );

  checks.push(
    await check('Mate invite RPC (optional fallback)', async () => {
      const { error } = await supabase.rpc('get_my_pending_mate_ride_requests');
      if (error) {
        if (/could not find the function|PGRST202/i.test(error.message ?? '')) {
          return 'missing — run supabase/FIX_missing_ride_request_rpc.sql (app still works via table read)';
        }
        throw new Error(error.message);
      }
      return 'OK';
    }),
  );

  const failed = checks.filter((c) => !c.ok);
  return {
    deviceId,
    checks,
    allOk: failed.length === 0,
    failed,
  };
}
