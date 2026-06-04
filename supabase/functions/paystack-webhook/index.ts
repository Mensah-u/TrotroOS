import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { pushToUser } from '../_shared/expoPush.ts';
import { verifyPaystackSignature } from '../_shared/paystack.ts';
import { getServiceClient, jsonResponse } from '../_shared/supabaseAdmin.ts';
import type { PaystackWebhookEvent } from '../_shared/types.ts';

serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  const valid = await verifyPaystackSignature(rawBody, signature);
  if (!valid) {
    console.error('[paystack-webhook] invalid x-paystack-signature');
    return jsonResponse({ ok: false, error: 'Invalid signature' }, 401);
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.error('[paystack-webhook] invalid JSON body');
    return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400);
  }

  const eventType = event.event ?? 'unknown';
  const reference = event.data?.reference?.trim();
  const eventId = String(event.data?.id ?? `${eventType}:${reference ?? 'no-ref'}`);

  console.log('[paystack-webhook] received', eventType, reference ?? 'no-ref', 'eventId', eventId);

  const supabase = getServiceClient();

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
    const paystackAmount = event.data?.amount;
    const currency = event.data?.currency ?? 'GHS';

    if (paystackStatus !== 'success') {
      console.warn('[paystack-webhook] charge.success but data.status =', paystackStatus);
      return jsonResponse({ ok: true, skipped: true, reason: 'non-success status in payload' });
    }

    if (currency !== 'GHS') {
      console.error('[paystack-webhook] unexpected currency', currency, reference);
      return jsonResponse({ ok: false, error: 'Unexpected currency' }, 400);
    }

    const { data: pendingTxn, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('id, user_id, reservation_id, amount_in_pesewas, metadata, status')
      .eq('reference', reference)
      .maybeSingle();

    if (fetchError) {
      console.error('[paystack-webhook] fetch failed:', fetchError.message);
      return jsonResponse({ ok: false, error: fetchError.message }, 500);
    }

    if (!pendingTxn) {
      console.warn('[paystack-webhook] unknown reference', reference);
      return jsonResponse({ ok: true, skipped: true, reason: 'unknown reference' });
    }

    if (pendingTxn.status === 'success') {
      console.log('[paystack-webhook] already success', reference);
      return jsonResponse({ ok: true, status: 'success', reference, duplicate: true });
    }

    if (
      typeof paystackAmount === 'number' &&
      paystackAmount !== pendingTxn.amount_in_pesewas
    ) {
      console.error(
        '[paystack-webhook] amount mismatch',
        reference,
        'expected',
        pendingTxn.amount_in_pesewas,
        'got',
        paystackAmount,
      );
      await supabase
        .from('payment_transactions')
        .update({
          status: 'failed',
          metadata: {
            ...(typeof pendingTxn.metadata === 'object' && pendingTxn.metadata ? pendingTxn.metadata : {}),
            paystack_event: eventType,
            paystack_data: event.data ?? {},
            failure_reason: 'amount_mismatch',
          },
        })
        .eq('reference', reference);

      return jsonResponse({ ok: false, error: 'Amount mismatch' }, 400);
    }

    const mergedMetadata = {
      ...(typeof pendingTxn.metadata === 'object' && pendingTxn.metadata ? pendingTxn.metadata : {}),
      paystack_event: eventType,
      paystack_data: event.data ?? {},
      confirmed_at: new Date().toISOString(),
    };

    const { data: txn, error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'success',
        metadata: mergedMetadata,
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
      console.warn('[paystack-webhook] race — transaction no longer pending', reference);
      return jsonResponse({ ok: true, skipped: true, reason: 'transaction not pending' });
    }

    if (txn.reservation_id) {
      const { error: resError } = await supabase
        .from('reservations')
        .update({ payment_reference: reference })
        .eq('id', txn.reservation_id)
        .eq('status', 'active');

      if (resError) {
        console.error('[paystack-webhook] reservation payment_reference update failed:', resError.message);
      } else {
        console.log('[paystack-webhook] linked reservation', txn.reservation_id, reference);
      }
    }

    const amountGhs = (txn.amount_in_pesewas / 100).toFixed(2);
    const { error: ledgerError } = await supabase.from('wallet_ledger').insert({
      user_id: txn.user_id,
      kind: 'spend',
      amount_ghs: amountGhs,
      reference,
      note: 'Paystack MoMo seat booking',
    });

    if (ledgerError) {
      console.error('[paystack-webhook] wallet_ledger insert failed (non-fatal):', ledgerError.message);
    }

    // Push notification: payment confirmed
    const paymentKind = (mergedMetadata as Record<string, unknown>)?.payment_kind ?? 'passenger_booking';
    if (paymentKind === 'mate_invite') {
      // Notify the mate their invite payment went through
      pushToUser(supabase, txn.user_id, {
        title: 'Invite payment confirmed',
        body: `GHS ${amountGhs} paid — seat invite sent to passenger.`,
        data: { type: 'mate_invite_paid', reference },
      }).catch(() => {});
    } else {
      // Notify the passenger their seat is reserved
      pushToUser(supabase, txn.user_id, {
        title: 'Seat reserved ✓',
        body: `GHS ${amountGhs} paid. Your seat is confirmed — your mate is on the way!`,
        data: { type: 'booking_success', reference, reservationId: txn.reservation_id ?? null },
      }).catch(() => {});
    }

    console.log('[paystack-webhook] success', reference, amountGhs, 'GHS');
    return jsonResponse({ ok: true, status: 'success', reference });
  }

  if (eventType === 'charge.failed') {
    const { data: existing } = await supabase
      .from('payment_transactions')
      .select('metadata')
      .eq('reference', reference)
      .maybeSingle();

    const { error: failError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        metadata: {
          ...(typeof existing?.metadata === 'object' && existing.metadata ? existing.metadata : {}),
          paystack_event: eventType,
          paystack_data: event.data ?? {},
        },
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
