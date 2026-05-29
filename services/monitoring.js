/**
 * Monitoring shim — no-op until a real provider is wired up.
 *
 * Why a shim?
 *   • You can sprinkle `recordError`, `recordEvent`, `startTransaction`
 *     anywhere in the codebase today and only flip the switch later.
 *   • If Sentry / Crashlytics are not installed, the calls degrade to
 *     console output (in __DEV__) or silent no-ops (in production), so
 *     nothing crashes when the package is absent.
 *   • The API mirrors Sentry's so we can swap implementations 1:1.
 *
 * To enable Sentry later:
 *   1. `npx expo install sentry-expo`
 *   2. Wrap App.js with `Sentry.Native.wrap(App)` and call
 *      `Sentry.init({ dsn })` at startup.
 *   3. Edit the `tryLoadSentry` block below to set `sentry` to the module.
 *
 * To enable Crashlytics on bare RN:
 *   1. `yarn add @react-native-firebase/app @react-native-firebase/crashlytics`
 *   2. Set `crashlytics` to `require('@react-native-firebase/crashlytics').default()`.
 */

import { SENTRY_DSN } from '@/constants/config';

let monitoringInitialized = false;
let sentry = null;
let crashlytics = null;

function tryLoadSentry() {
  if (sentry) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
    const mod = require('sentry-expo');
    if (mod?.Native) sentry = mod.Native;
  } catch {
    sentry = null;
  }
}

/** Call once at app startup (App.js). Safe if sentry-expo is not installed. */
export function initMonitoring() {
  if (monitoringInitialized) return;
  monitoringInitialized = true;

  const dsn = SENTRY_DSN;
  if (!dsn) {
    log('event', 'monitoring_init_skipped', { reason: 'no_dsn' });
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
    const Sentry = require('sentry-expo');
    Sentry.init({
      dsn,
      enableInExpoDevelopment: false,
      debug: false,
    });
    sentry = Sentry.Native ?? Sentry;
    recordEvent('monitoring_initialized', { provider: 'sentry-expo' });
  } catch (e) {
    log('warn', 'Sentry init failed (install sentry-expo for production):', e?.message);
    tryLoadSentry();
  }
}

function tryLoadCrashlytics() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
    const mod = require('@react-native-firebase/crashlytics');
    crashlytics = typeof mod?.default === 'function' ? mod.default() : null;
  } catch {
    crashlytics = null;
  }
}

tryLoadCrashlytics();

function log(level, ...args) {
  // eslint-disable-next-line no-undef
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : 'log'](`[monitoring:${level}]`, ...args);
  }
}

/** Identify the current user / device for downstream provider dashboards. */
export function setUser({ id, email, deviceId, role } = {}) {
  try {
    sentry?.setUser({ id, email, ip_address: '{{auto}}' });
    sentry?.setTag?.('role', role || 'unknown');
    sentry?.setTag?.('deviceId', deviceId || 'unknown');
    crashlytics?.setUserId?.(String(id || deviceId || ''));
    crashlytics?.setAttribute?.('role', role || 'unknown');
  } catch (e) {
    log('warn', 'setUser failed:', e?.message);
  }
}

export function recordEvent(name, data = {}) {
  try {
    sentry?.addBreadcrumb({ category: 'event', message: name, level: 'info', data });
    crashlytics?.log?.(`event:${name}:${JSON.stringify(data)}`);
  } catch (e) {
    log('warn', 'recordEvent failed:', e?.message);
  }
  log('event', name, data);
}

export function recordError(err, context = {}) {
  try {
    if (sentry?.captureException) {
      sentry.captureException(err, { extra: context });
    }
    if (crashlytics?.recordError) {
      crashlytics.recordError(err instanceof Error ? err : new Error(String(err)));
    }
  } catch (e) {
    log('warn', 'recordError failed:', e?.message);
  }
  log('error', err?.message || err, context);
}

/**
 * Lightweight performance tracing. Returns a `finish(extra?)` callback you
 * call when the operation completes.
 */
export function startTransaction(name, opts = {}) {
  const startedAt = Date.now();
  let txn = null;
  try {
    if (sentry?.startTransaction) {
      txn = sentry.startTransaction({ name, op: opts.op || 'custom' });
    }
  } catch (e) {
    log('warn', 'startTransaction failed:', e?.message);
  }
  return {
    finish: (extra = {}) => {
      const elapsedMs = Date.now() - startedAt;
      try {
        if (txn) {
          if (extra && typeof extra === 'object') {
            Object.entries(extra).forEach(([k, v]) => txn.setData?.(k, v));
          }
          txn.finish?.();
        }
      } catch (e) {
        log('warn', 'finish failed:', e?.message);
      }
      log('perf', name, `${elapsedMs}ms`, extra);
      return elapsedMs;
    },
  };
}

/**
 * Cheap budget-alert helper: count a discrete unit (e.g. realtime msgs,
 * function calls) and warn locally if a 1-minute rolling window blows past
 * the threshold. Hook this into Crashlytics non-fatals for prod visibility.
 */
const counters = new Map();
export function bumpCounter(name, { warnPerMinute = Infinity } = {}) {
  const bucket = Math.floor(Date.now() / 60_000);
  const key = `${name}:${bucket}`;
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  if (next === warnPerMinute) {
    recordEvent('budget_threshold_hit', { name, count: next, perMinute: warnPerMinute });
  }
  // Prune old buckets opportunistically.
  if (counters.size > 200) {
    for (const k of counters.keys()) {
      const b = Number(k.split(':').pop());
      if (b < bucket - 5) counters.delete(k);
    }
  }
}

export default {
  initMonitoring,
  setUser,
  recordEvent,
  recordError,
  startTransaction,
  bumpCounter,
};
