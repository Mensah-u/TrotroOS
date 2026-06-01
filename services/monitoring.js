/**
 * Production monitoring — @sentry/react-native when EXPO_PUBLIC_SENTRY_DSN is set.
 *
 * EAS builds: set SENTRY_AUTH_TOKEN in EAS secrets for source map uploads.
 * Org: trotroos · Project: react-native
 */

import { SENTRY_DSN } from '@/constants/config';

let monitoringInitialized = false;
let Sentry = null;

function loadSentry() {
  if (Sentry !== null) return Sentry;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
    Sentry = require('@sentry/react-native');
  } catch {
    Sentry = false;
  }
  return Sentry;
}

function log(level, ...args) {
  // eslint-disable-next-line no-undef
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : 'log'](`[monitoring:${level}]`, ...args);
  }
}

/** Call once at app startup (App.js). Safe when @sentry/react-native is not installed. */
export function initMonitoring() {
  if (monitoringInitialized) return;
  monitoringInitialized = true;

  const dsn = SENTRY_DSN?.trim();
  if (!dsn) {
    log('event', 'monitoring_init_skipped', { reason: 'no_dsn' });
    return;
  }

  const sdk = loadSentry();
  if (!sdk?.init) {
    log('warn', 'Sentry SDK missing — run: npx expo install @sentry/react-native');
    return;
  }

  try {
    sdk.init({
      dsn,
      enableInExpoDevelopment: false,
      debug: false,
      tracesSampleRate: 0.2,
      enableAutoSessionTracking: true,
      attachStacktrace: true,
    });
    recordEvent('monitoring_initialized', { provider: '@sentry/react-native' });
  } catch (e) {
    log('warn', 'Sentry init failed:', e?.message);
  }
}

/** Wrap root App for native crash capture. No-op when DSN is unset. */
export function wrapAppWithMonitoring(AppComponent) {
  if (!SENTRY_DSN?.trim()) return AppComponent;
  const sdk = loadSentry();
  return typeof sdk?.wrap === 'function' ? sdk.wrap(AppComponent) : AppComponent;
}

function getNativeSentry() {
  const sdk = loadSentry();
  return sdk && sdk !== false ? sdk : null;
}

/** Identify the current user / device for downstream provider dashboards. */
export function setUser({ id, email, deviceId, role } = {}) {
  try {
    const sentry = getNativeSentry();
    sentry?.setUser?.({ id, email, ip_address: '{{auto}}' });
    sentry?.setTag?.('role', role || 'unknown');
    sentry?.setTag?.('deviceId', deviceId || 'unknown');
  } catch (e) {
    log('warn', 'setUser failed:', e?.message);
  }
}

export function recordEvent(name, data = {}) {
  try {
    const sentry = getNativeSentry();
    sentry?.addBreadcrumb?.({ category: 'event', message: name, level: 'info', data });
  } catch (e) {
    log('warn', 'recordEvent failed:', e?.message);
  }
  log('event', name, data);
}

export function recordError(err, context = {}) {
  try {
    const sentry = getNativeSentry();
    if (sentry?.captureException) {
      sentry.captureException(err, { extra: context });
    }
  } catch (e) {
    log('warn', 'recordError failed:', e?.message);
  }
  log('error', err?.message || err, context);
}

export function startTransaction(name, opts = {}) {
  const startedAt = Date.now();
  let txn = null;
  try {
    const sentry = getNativeSentry();
    if (sentry?.startInactiveSpan) {
      txn = sentry.startInactiveSpan({ name, op: opts.op || 'custom' });
    }
  } catch (e) {
    log('warn', 'startTransaction failed:', e?.message);
  }
  return {
    finish: (extra = {}) => {
      const elapsedMs = Date.now() - startedAt;
      try {
        if (txn?.end) txn.end();
      } catch (e) {
        log('warn', 'finish failed:', e?.message);
      }
      log('perf', name, `${elapsedMs}ms`, extra);
      return elapsedMs;
    },
  };
}

const counters = new Map();
export function bumpCounter(name, { warnPerMinute = Infinity } = {}) {
  const bucket = Math.floor(Date.now() / 60_000);
  const key = `${name}:${bucket}`;
  const next = (counters.get(key) ?? 0) + 1;
  counters.set(key, next);
  if (next === warnPerMinute) {
    recordEvent('budget_threshold_hit', { name, count: next, perMinute: warnPerMinute });
  }
  if (counters.size > 200) {
    for (const k of counters.keys()) {
      const b = Number(k.split(':').pop());
      if (b < bucket - 5) counters.delete(k);
    }
  }
}

export default {
  initMonitoring,
  wrapAppWithMonitoring,
  setUser,
  recordEvent,
  recordError,
  startTransaction,
  bumpCounter,
};
