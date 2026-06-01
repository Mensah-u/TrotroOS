import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { verifyPaystackSignature } from '../_shared/paystack.ts';
import { getServiceClient, jsonResponse } from '../_shared/supabaseAdmin.ts';

type PaystackEvent = {
  event?: string;
  data?: {
    id?: number | string;
    reference?: string;
    status?: string;
    amount?: number;
    metadata?: Record<string, unknown>;
  };
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  const valid = await verifyPaystackSignature(rawBody, signature);
  if (!valid) {
    console.error('[paystack-webhook] invalid signature');
    return jsonResponse({ ok: false, error: 'Invalid signature' }, 401);
  }

  let event: PaystackEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.error('[paystack-webhook] invalid JSON');
    return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const eventType = event.event ?? 'unknown';
  const reference = event.data?.reference?.trim();
  const eventId = String(event.data?.id ?? `${eventType}:${reference ?? 'no-ref'}`);

  console.log('[paystack-webhook] received', eventType, reference ?? 'no-ref');

  const supabase = getServiceClient();

  // Idempotency — skip duplicate webhook deliveries
  const { error: claimError } = await supabase.from('webhook_events').insert({
    provider: 'paystack',
    event_id: eventId,
    event_type: eventType,
    raw: event,
  });

  if (claimError) {
    if (claimError.code === '23505') {
      console.log('[paystack-webhook] duplicate event', eventId);
      return jsonResponse({ ok: true, duplicate: true });
    }
    console.error('[paystack-webhook] idempotency insert failed:', claimError.message);
    return jsonResponse({ ok: false, error: claimError.message }, 500);
  }

  if (!reference) {
    console.warn('[paystack-webhook] no reference in payload');
    return jsonResponse({ ok: true, skipped: true, reason: 'no reference' });
  }

  if (eventType === 'charge.success') {
    const paystackStatus = event.data?.status;
    const nextStatus = paystackStatus === 'success' ? 'success' : 'failed';

    const { data: txn, error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: nextStatus,
        metadata: {
          paystack_event: eventType,
          paystack_data: event.data ?? {},
        },
      })
      .eq('reference', reference)
      .eq('status', 'pending')
      .select('id, user_id, reservation_id, amount_in_pesewas')
      .maybeSingle();

    if (updateError) {
      console.error('[paystack-webhook] update failed:', updateError.message);
      return jsonResponse({ ok: false, error: updateError.message }, 500);
    }

    if (!txn) {
      console.warn('[paystack-webhook] no pending transaction for', reference);
      return jsonResponse({ ok: true, skipped: true, reason: 'transaction not pending' });
    }

    if (nextStatus === 'success') {
      const amountGhs = (txn.amount_in_pesewas / 100).toFixed(2);

      if (txn.reservation_id) {
        const { error: resError } = await supabase
          .from('reservations')
          .update({ status: 'paid' })
          .eq('id', txn.reservation_id)
          .eq('status', 'active');

        if (resError) {
          console.error('[paystack-webhook] reservation update failed:', resError.message);
        }
      }

      await supabase.from('wallet_ledger').insert({
        user_id: txn.user_id,
        kind: 'spend',
        amount_ghs: amountGhs,
        reference,
        note: 'Paystack MoMo seat booking',
      });

      console.log('[paystack-webhook] success', reference, amountGhs, 'GHS');
    } else {
      console.warn('[paystack-webhook] charge.success but status != success', paystackStatus);
    }

    return jsonResponse({ ok: true, status: nextStatus, reference });
  }

  if (eventType === 'charge.failed') {
    const { error: failError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        metadata: { paystack_event: eventType, paystack_data: event.data ?? {} },
      })
      .eq('reference', reference)
      .in('status', ['pending']);

    if (failError) {
      console.error('[paystack-webhook] failed update error:', failError.message);
      return jsonResponse({ ok: false, error: failError.message }, 500);
    }

    console.log('[paystack-webhook] marked failed', reference);
    return jsonResponse({ ok: true, status: 'failed', reference });
  }

  console.log('[paystack-webhook] ignored event type', eventType);
  return jsonResponse({ ok: true, ignored: true, event: eventType });
});
