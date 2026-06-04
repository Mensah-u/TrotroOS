/**
 * request-payout — validate payout request, create Paystack transfer recipient,
 * initiate Paystack Transfer, and update payout status.
 *
 * POST body: { payoutId }
 *
 * Callers:
 *   • Service role (admin / cron): unrestricted.
 *   • Authenticated mate (their own payout): ownership is verified before processing.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  corsHeaders,
  errorResponse,
  getBearerToken,
  getPaystackSecretKey,
  getServiceClient,
  getUserClient,
  isServiceRoleKey,
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

  // ── Authorization ────────────────────────────────────────────────────────
  const jwt = getBearerToken(req);
  if (!jwt) return errorResponse('Authorization header required', 401);

  let callerUid: string | null = null;
  if (!isServiceRoleKey(jwt)) {
    const userClient = getUserClient(jwt);
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return errorResponse('Authenticated user required', 401);
    callerUid = user.id; // will verify ownership below
  }
  // ── End Authorization ─────────────────────────────────────────────────────

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

  // If called by a mate (not service role), verify they own this request
  if (callerUid && payout.mate_id !== callerUid) {
    return errorResponse('Forbidden', 403);
  }

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
