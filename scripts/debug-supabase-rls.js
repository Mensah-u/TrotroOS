#!/usr/bin/env node
/**
 * Debug Supabase RLS + core tables for TrotroOS.
 * Run: node scripts/debug-supabase-rls.js
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;
    const m = line.match(/^([^=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (val && !process.env[key]?.trim()) process.env[key] = val;
  }
}

loadEnv();

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (!URL || !KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const deviceId = randomUUID();
const results = [];

function log(name, ok, detail) {
  results.push({ name, ok, detail });
  const mark = ok ? 'OK' : 'FAIL';
  console.log(`${mark.padEnd(5)} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function rest(table, { method = 'GET', query = '', body, deviceHeader = true } = {}) {
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    Prefer: method === 'GET' ? 'return=minimal' : 'return=representation',
  };
  if (deviceHeader) headers['x-device-id'] = deviceId;

  const res = await fetch(`${URL}/rest/v1/${table}${query}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, ok: res.ok };
}

async function rpc(fn, args = {}, deviceHeader = true) {
  const headers = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
  };
  if (deviceHeader) headers['x-device-id'] = deviceId;

  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json, ok: res.ok };
}

(async () => {
  console.log('\n=== TrotroOS Supabase RLS debug ===');
  console.log(`URL: ${URL}`);
  console.log(`Test device: ${deviceId}\n`);

  // request_device_id() via a harmless read pattern
  const trips = await rest('trips', { query: '?select=id,status&status=in.(active,full)&limit=3' });
  log('Read active trips (anon)', trips.ok, trips.ok ? `${Array.isArray(trips.json) ? trips.json.length : 0} rows` : JSON.stringify(trips.json));

  const drivers = await rest('driver_locations', { query: '?select=mate_id,route,available_seats&limit=3' });
  log('Read driver_locations (anon)', drivers.ok, drivers.ok ? `${Array.isArray(drivers.json) ? drivers.json.length : 0} rows` : JSON.stringify(drivers.json));

  const profileUpsert = await rest('passenger_profiles', {
    method: 'POST',
    query: '?on_conflict=device_id',
    body: {
      device_id: deviceId,
      display_name: 'Debug Test',
      updated_at: new Date().toISOString(),
    },
  });
  // PostgREST upsert needs Prefer: resolution=merge-duplicates
  const profileRes = await fetch(`${URL}/rest/v1/passenger_profiles?on_conflict=device_id`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      device_id: deviceId,
      display_name: 'Debug Test',
      updated_at: new Date().toISOString(),
    }),
  });
  const profileJson = await profileRes.json().catch(() => null);
  log(
    'Upsert passenger_profiles (with x-device-id)',
    profileRes.ok,
    profileRes.ok ? 'saved' : JSON.stringify(profileJson),
  );

  const profileRead = await rest('passenger_profiles', {
    query: `?select=device_id&device_id=eq.${deviceId}`,
  });
  log(
    'Read own passenger_profiles',
    profileRead.ok && Array.isArray(profileRead.json) && profileRead.json.length === 1,
    profileRead.ok ? `${profileRead.json?.length ?? 0} row(s)` : JSON.stringify(profileRead.json),
  );

  const locUpsert = await fetch(`${URL}/rest/v1/passenger_locations`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      passenger_id: deviceId,
      latitude: 6.673,
      longitude: -1.565,
      queued_route: 'Tech Junction → Ayeduase',
      updated_at: new Date().toISOString(),
    }),
  });
  const locJson = await locUpsert.json().catch(() => null);
  log(
    'Upsert passenger_locations (I\'m waiting)',
    locUpsert.ok,
    locUpsert.ok ? 'saved' : JSON.stringify(locJson),
  );

  let tripId = trips.json?.[0]?.id ?? null;
  if (tripId) {
    const resInsert = await fetch(`${URL}/rest/v1/reservations`, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        'x-device-id': deviceId,
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        trip_id: tripId,
        passenger_id: deviceId,
        status: 'active',
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }),
    });
    const resJson = await resInsert.json().catch(() => null);
    log('Create reservation', resInsert.ok, resInsert.ok ? 'created' : JSON.stringify(resJson));

    if (resInsert.ok && resJson?.[0]?.id) {
      await fetch(`${URL}/rest/v1/reservations?id=eq.${resJson[0].id}`, {
        method: 'DELETE',
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'x-device-id': deviceId },
      }).catch(() => {});
    }
  } else {
    log('Create reservation', false, 'skipped — no active trip to reserve');
  }

  // Without device header — should fail for scoped tables
  const profileNoHeader = await rest('passenger_profiles', {
    query: `?select=device_id&device_id=eq.${deviceId}`,
    deviceHeader: false,
  });
  log(
    'Read passenger_profiles WITHOUT x-device-id (expect 0 rows or RLS fail)',
    !profileNoHeader.ok || (Array.isArray(profileNoHeader.json) && profileNoHeader.json.length === 0),
    profileNoHeader.ok ? `${profileNoHeader.json?.length ?? 0} rows leaked` : 'blocked (good)',
  );

  const expireRpc = await rpc('expire_stale_mate_ride_requests', {}, true);
  log(
    'RPC expire_stale_mate_ride_requests',
    expireRpc.ok,
    expireRpc.ok ? 'callable' : JSON.stringify(expireRpc.json),
  );

  const rpcCheck = await rpc('get_my_pending_mate_ride_requests', {}, true);
  const rideReq = await rest('mate_ride_requests', {
    query: '?select=id,status&status=eq.pending&limit=3',
  });
  const tableReadOk = rideReq.ok;
  log(
    'RPC get_my_pending_mate_ride_requests',
    rpcCheck.ok || tableReadOk,
    rpcCheck.ok
      ? 'callable'
      : tableReadOk
        ? 'missing (optional — table read works; run FIX_missing_ride_request_rpc.sql)'
        : JSON.stringify(rpcCheck.json),
  );

  log(
    'Read mate_ride_requests (passenger pending)',
    rideReq.ok,
    rideReq.ok ? `${Array.isArray(rideReq.json) ? rideReq.json.length : 0} rows` : JSON.stringify(rideReq.json),
  );

  const pushRes = await fetch(`${URL}/rest/v1/push_tokens`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      'x-device-id': deviceId,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: deviceId,
      user_role: 'passenger',
      expo_push_token: `ExponentPushToken[debug-${Date.now()}]`,
      platform: 'android',
      updated_at: new Date().toISOString(),
    }),
  });
  const pushJson = await pushRes.text();
  log('Upsert push_tokens (passenger)', pushRes.ok, pushRes.ok ? 'saved' : pushJson.slice(0, 200));

  const failed = results.filter((r) => !r.ok);
  console.log('\n=== Summary ===');
  if (failed.length === 0) {
    console.log('All checks passed. If the app still fails, reload Expo (press r) after SQL schema reload.');
  } else {
    console.log(`${failed.length} check(s) failed:`);
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    console.log('\nFix: Re-run supabase/FIX_baseline_rls_policies.sql in SQL Editor, then Settings → API → Reload schema.');
  }
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
