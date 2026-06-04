import { supabase } from '@/services/supabase';

export const PAYOUT_NETWORKS = ['MTN', 'Vodafone', 'AirtelTigo'];
export const MIN_PAYOUT_GHS = 5;

/**
 * Request a payout.
 * 1. Creates a `mate_payout_requests` row via RPC (returns payout_id).
 * 2. Immediately invokes the `request-payout` edge function to kick off the
 *    Paystack transfer — no admin approval step needed.
 */
export async function requestPayout({ amountGhs, momoNumber, network }) {
  // Step 1: create the pending payout row
  const { data, error } = await supabase.rpc('request_mate_payout', {
    p_amount_ghs: amountGhs,
    p_momo_number: momoNumber,
    p_network: network ?? 'MTN',
  });
  if (error) return { ok: false, error: error.message };
  if (data?.ok === false) return { ok: false, error: data.error ?? 'Request failed' };

  const payoutId = data?.payout_id;

  // Step 2: kick off Paystack transfer via edge function
  if (payoutId) {
    try {
      const { error: fnErr } = await supabase.functions.invoke('request-payout', {
        body: { payoutId },
      });
      if (fnErr) {
        // The row was created but transfer initiation failed — the mate will
        // see "pending" status and can retry via support. Non-fatal from UX POV.
        console.warn('[matePayouts] request-payout edge fn error:', fnErr.message);
        return {
          ok: true,
          message: 'Payout request submitted. Transfer will be processed shortly.',
          payoutId,
          transferStarted: false,
        };
      }
    } catch (e) {
      console.warn('[matePayouts] request-payout invoke threw:', e?.message ?? e);
      return {
        ok: true,
        message: 'Payout request submitted. Transfer will be processed shortly.',
        payoutId,
        transferStarted: false,
      };
    }
  }

  return {
    ok: true,
    message: data?.message ?? 'Payout submitted. Funds will arrive on your MoMo shortly.',
    payoutId,
    transferStarted: !!payoutId,
  };
}

export async function getPayoutHistory() {
  const { data, error } = await supabase
    .from('mate_payout_requests')
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(20);
  if (error) return { data: [], error: error.message };
  return { data: data ?? [], error: null };
}

export function formatPayoutStatus(status) {
  switch (status) {
    case 'pending':    return { label: 'Pending',    color: '#FCD34D' };
    case 'processing': return { label: 'Processing', color: '#60A5FA' };
    case 'paid':       return { label: 'Paid',       color: '#4ADE80' };
    case 'rejected':   return { label: 'Rejected',   color: '#F87171' };
    default:           return { label: status,       color: '#A8A8A8' };
  }
}
