import { supabase } from '@/services/supabase';

export const PAYOUT_NETWORKS = ['MTN', 'Vodafone', 'AirtelTigo'];
export const MIN_PAYOUT_GHS = 5;

export async function requestPayout({ amountGhs, momoNumber, network }) {
  const { data, error } = await supabase.rpc('request_mate_payout', {
    p_amount_ghs: amountGhs,
    p_momo_number: momoNumber,
    p_network: network ?? 'MTN',
  });
  if (error) return { ok: false, error: error.message };
  if (data?.ok === false) return { ok: false, error: data.error ?? 'Request failed' };
  return { ok: true, message: data?.message ?? 'Payout requested' };
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
