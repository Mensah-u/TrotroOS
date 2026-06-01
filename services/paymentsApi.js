/**
 * Paystack payments — Supabase Edge Functions (primary) or Express API (fallback).
 *
 * Server calculates: seat_fare + 8% platform fee + 1 GHS request fee.
 * Paystack confirms via webhook — never trust redirect URLs alone.
 */

import * as WebBrowser from 'expo-web-browser';

import { apiAvailable, apiFetch } from '@/services/apiClient';
import { supabase } from '@/services/supabase';

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 5 * 60_000;

async function initPaymentEdge({ userId, seatFare, email, reservationId }) {
  const { data, error } = await supabase.functions.invoke('initialize-payment', {
    body: { userId, seatFare, email, reservationId },
  });

  if (error) {
    return { ok: false, error: { message: error.message ?? 'edge function error' } };
  }
  if (!data?.ok) {
    return { ok: false, error: { message: data?.error ?? 'init failed' } };
  }
  return {
    ok: true,
    data: {
      reference: data.reference,
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      amountInPesewas: data.amount_in_pesewas,
      breakdown: data.breakdown,
    },
  };
}

async function initPaymentApi({ reservationId, passengerId, amountGhs, channel, email }) {
  const { ok, data, error } = await apiFetch('/payments/init', {
    method: 'POST',
    body: { reservationId, passengerId, amountGhs, channel, email },
  });
  if (!ok || !data?.reference) {
    return { ok: false, error: error ?? { message: 'init failed' } };
  }
  return { ok: true, data };
}

/**
 * Initialise a Paystack MoMo/card checkout.
 * @param {{ userId: string, seatFare: number|string, email: string, reservationId?: string, channel?: string }} params
 */
export async function initPayment({
  userId,
  passengerId,
  seatFare,
  amountGhs,
  email,
  reservationId,
  channel = 'momo',
}) {
  const payerId = userId ?? passengerId;
  if (!payerId) {
    return { ok: false, error: { message: 'userId is required' } };
  }
  if (!email?.trim()) {
    return { ok: false, error: { message: 'email is required for Paystack' } };
  }

  const fare = seatFare ?? amountGhs;
  if (fare == null) {
    return { ok: false, error: { message: 'seatFare is required' } };
  }

  // Prefer Supabase Edge Function (secure fee calculation)
  try {
    const edge = await initPaymentEdge({
      userId: payerId,
      seatFare: fare,
      email: email.trim(),
      reservationId,
    });
    if (edge.ok) return edge;
  } catch (e) {
    // Fall through to Express API if edge function unavailable
  }

  if (!apiAvailable()) {
    return { ok: false, error: { message: 'payments unavailable — configure Supabase Edge Functions or API_BASE_URL' } };
  }

  return initPaymentApi({
    reservationId,
    passengerId: payerId,
    amountGhs: Number(fare),
    channel,
    email,
  });
}

/** Open Paystack checkout in an in-app browser. */
export async function openPaystackCheckout(authorizationUrl) {
  if (!authorizationUrl) return { ok: false, error: { message: 'no authorization URL' } };
  const result = await WebBrowser.openBrowserAsync(authorizationUrl, {
    dismissButtonStyle: 'close',
    enableBarCollapsing: true,
  });
  return { ok: true, result };
}

export async function getPaymentStatus(reference) {
  const { data, error } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();

  if (!error && data) {
    return { ok: true, data: { ...data, status: data.status } };
  }

  if (apiAvailable()) {
    const api = await apiFetch(`/payments/${encodeURIComponent(reference)}`);
    if (api.ok && api.data) return { ok: true, data: api.data };
  }

  if (error) return { ok: false, error: { message: error.message } };
  return { ok: false, error: { message: 'unknown reference' } };
}

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

export { estimatePaymentTotal } from '@/utils/paymentMath';
