/**
 * Payments client. Talks to the backend API which talks to Paystack.
 *
 * Important: the *only* source of truth for payment status is the server,
 * because Paystack confirms via webhook. The redirect URL after the user
 * pays is just a UI hint — we always poll `getPaymentStatus` until we see
 * a terminal status (`success` / `failed` / `cancelled`).
 */

import { apiAvailable, apiFetch } from '@/services/apiClient';

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 5 * 60_000;

export async function initPayment({ reservationId, passengerId, amountGhs, channel = 'momo', email }) {
  if (!apiAvailable()) {
    return { ok: false, error: { message: 'payments unavailable — API not configured' } };
  }
  const { ok, data, error } = await apiFetch('/payments/init', {
    method: 'POST',
    body: { reservationId, passengerId, amountGhs, channel, email },
  });
  if (!ok || !data?.reference) {
    return { ok: false, error: error ?? { message: 'init failed' } };
  }
  return { ok: true, data };
}

export async function getPaymentStatus(reference) {
  const { ok, data, error } = await apiFetch(`/payments/${encodeURIComponent(reference)}`);
  if (!ok || !data) return { ok: false, error };
  return { ok: true, data };
}

/**
 * Poll the backend until the payment is in a terminal state or we time out.
 * The redirect URL is NOT trusted — only the webhook-driven server status is.
 *
 * @param {string} reference
 * @param {{ onTick?: (status: string)=>void, intervalMs?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<{ status: 'success'|'failed'|'cancelled'|'timeout', payment?: object }>}
 */
export async function waitForPaymentConfirmation(reference, opts = {}) {
  const interval = opts.intervalMs ?? POLL_INTERVAL_MS;
  const timeout = opts.timeoutMs ?? MAX_POLL_DURATION_MS;
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const { ok, data } = await getPaymentStatus(reference);
    if (ok && data) {
      opts.onTick?.(data.status);
      if (data.status === 'success' || data.status === 'failed' || data.status === 'cancelled') {
        return { status: data.status, payment: data };
      }
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return { status: 'timeout' };
}
