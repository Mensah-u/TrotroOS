#!/usr/bin/env node
/**
 * Builds supabase/TrotroOS_COMPLETE.sql from all project SQL patches in run order.
 * Usage: node scripts/build-complete-sql.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'supabase');
const OUT = path.join(ROOT, 'TrotroOS_COMPLETE.sql');

/** Run order — later files override earlier (RLS, RPCs). Safe to re-run. */
const FILES = [
  'RUN_THIS_FIRST.sql',
  'FIX_trip_fare.sql',
  'FIX_v14_features.sql',
  'FIX_mate_ride_requests.sql',
  'FIX_mate_reservations.sql',
  'FIX_nearby_indexes.sql',
  'FIX_payments_and_wallet.sql',
  'migrations/007_payment_transactions.sql',
  'migrations/008_payment_reservation_link.sql',
  'migrations/009_mate_invite_payments.sql',
  'migrations/010_mate_payouts.sql',
  'FIX_reservations_passenger_id_alter.sql',
  'FIX_baseline_rls_policies.sql',
  'FIX_security_hardening.sql',
  'FIX_missing_ride_request_rpc.sql',
];

const header = `-- ═══════════════════════════════════════════════════════════════════════════
-- TrotroOS · COMPLETE DATABASE SETUP (auto-generated)
-- Generated: ${new Date().toISOString()}
--
-- Paste this ENTIRE file into Supabase SQL Editor → Run once
-- https://supabase.com/dashboard/project/siwzjxwholmoassrdtwx/sql/new
--
-- After Run: Settings → API → Reload schema (or wait ~60s)
-- Then reload the app (press r in Metro)
--
-- Source files (in order):
${FILES.map((f, i) => `--   ${i + 1}. ${f}`).join('\n')}
--
-- Safe to re-run on an existing project (uses IF NOT EXISTS / DROP POLICY IF EXISTS).
-- ═══════════════════════════════════════════════════════════════════════════

`;

const parts = [header];

for (const rel of FILES) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    console.error(`Missing: ${rel}`);
    process.exit(1);
  }
  const body = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
  parts.push(`\n\n-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  parts.push(`-- BEGIN: ${rel}\n`);
  parts.push(`-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`);
  parts.push(body.trim());
  parts.push('\n');
}

parts.push('\n-- ═══════════════════════════════════════════════════════════════════════════\n');
parts.push('-- END TrotroOS_COMPLETE.sql\n');
parts.push('NOTIFY pgrst, \'reload schema\';\n');

fs.writeFileSync(OUT, parts.join(''), 'utf8');

const lines = parts.join('').split('\n').length;
const kb = (Buffer.byteLength(parts.join(''), 'utf8') / 1024).toFixed(1);
console.log(`Wrote ${OUT}`);
console.log(`  ${lines} lines, ${kb} KB, ${FILES.length} source files`);
