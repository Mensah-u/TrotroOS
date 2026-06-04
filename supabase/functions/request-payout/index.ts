/**
 * request-payout — validate payout request, create Paystack transfer recipient,
 * initiate Paystack Transfer, and update payout status.
 *
 * POST body: { payoutId } — called by admin / cron after approving a pending request.
 * Requires service role (no public access).
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  corsHeaders,
  errorResponse,
  getPaystackSecretKey,
  getServiceClient,
  jsonResponse,
} from '../_shared/supabaseAdmin.ts';
import { pushToUser } from '../_shared/expoPush.ts';

const PAYSTACK_BASE = 'https://api.paystack.co';

async function paystackPost(path: string, body: unknown, key: string) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { ok: res.ok, data: json };
}

async function createTransferRecipient(momoNumber: string, network: string, name: string, key: string) {
  const bankCode: Record<string, string> = {
    MTN: 'MTN',
    Vodafone: 'VOD',
    AirtelTigo: 'ATL',
  };
  const { ok, data } = await paystackPost('/transferrecipient', {
    type: 'mobile_money',
    name,
    account_number: momoNumber,
    bank_code: bankCode[network] ?? 'MTN',
    currency: 'GHS',
  }, key);
  if (!ok || !data?.data?.recipient_code) {
    throw new Error(data?.message ?? 'Failed to create Paystack transfer recipient');
  }
  return data.data.recipient_code as string;
}

async function initiateTransfer(recipientCode: string, amountGhs: number, reference: string, key: string) {
  const { ok, data } = await paystackPost('/transfer', {
    source: 'balance',
    amount: Math.round(amountGhs * 100),
    recipient: recipientCode,
    reason: `TrotroOS mate payout ${reference}`,
    currency: 'GHS',
  }, key);
  if (!ok) {
    throw new Error(data?.message ?? 'Paystack transfer initiation failed');
  }
  return data.data?.transfer_code as string | undefined;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  let body: { payoutId?: string };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const payoutId = body.payoutId?.trim();
  if (!payoutId) return errorResponse('payoutId is required');

  const supabase = getServiceClient();

  const { data: payout, error: fetchErr } = await supabase
    .from('mate_payout_requests')
    .select('*, mate_profiles!inner(full_name)')
    .eq('id', payoutId)
    .maybeSingle();

  if (fetchErr) return errorResponse(fetchErr.message, 500);
  if (!payout) return errorResponse('Payout request not found', 404);
  if (payout.status !== 'pending') {
    return jsonResponse({ ok: true, skipped: true, status: payout.status });
  }

  await supabase
    .from('mate_payout_requests')
    .update({ status: 'processing' })
    .eq('id', payoutId);

  let transferCode: string | undefined;
  let secretKey: string;

  try {
    secretKey = getPaystackSecretKey();
    const mateName = (payout.mate_profiles as unknown as { full_name?: string })?.full_name ?? 'TrotroOS Mate';
    const recipientCode = await createTransferRecipient(
      payout.momo_number,
      payout.network,
      mateName,
      secretKey,
    );
    transferCode = await initiateTransfer(
      recipientCode,
      Number(payout.amount_ghs),
      payoutId,
      secretKey,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[request-payout] transfer failed:', msg);

    await supabase
      .from('mate_payout_requests')
      .update({ status: 'rejected', admin_note: msg })
      .eq('id', payoutId);

    // Notify mate of failure
    pushToUser(supabase, payout.mate_id, {
      title: 'Payout failed',
      body: 'Your payout request could not be processed. Contact support.',
      data: { type: 'payout_failed', payoutId },
    }).catch(() => {});

    return errorResponse(msg, 502);
  }

  await supabase
    .from('mate_payout_requests')
    .update({
      status: 'paid',
      paystack_transfer_code: transferCode ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', payoutId);

  // Notify mate of success
  pushToUser(supabase, payout.mate_id, {
    title: 'Payout sent ✓',
    body: `GHS ${Number(payout.amount_ghs).toFixed(2)} is on its way to your MoMo number.`,
    data: { type: 'payout_paid', payoutId, amount: payout.amount_ghs },
  }).catch(() => {});

  console.log('[request-payout] processed', payoutId, payout.amount_ghs, 'GHS');
  return jsonResponse({ ok: true, transferCode });
});
