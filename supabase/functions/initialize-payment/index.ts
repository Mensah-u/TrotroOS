import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { verifyUserAccess } from '../_shared/auth.ts';
import {
  computePaymentBreakdown,
  generatePaystackReference,
  parseSeatFareInput,
} from '../_shared/paymentMath.ts';
import { initializePaystackTransaction } from '../_shared/paystack.ts';
import {
  corsHeaders,
  errorResponse,
  getServiceClient,
  jsonResponse,
} from '../_shared/supabaseAdmin.ts';
import type { InitializePaymentBody } from '../_shared/types.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  let body: InitializePaymentBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const userId = body.userId?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!userId) return errorResponse('userId is required');
  if (!email || !EMAIL_RE.test(email)) return errorResponse('A valid email is required');

  if (body.reservationId && !UUID_RE.test(body.reservationId)) {
    return errorResponse('reservationId must be a valid UUID');
  }

  const accessError = await verifyUserAccess(req, userId, async (token) => {
    const supabase = getServiceClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return { user: null };
    return { user: data.user };
  });
  if (accessError) {
    console.error('[initialize-payment] auth failed:', accessError);
    return errorResponse(accessError, 403);
  }

  const parsedFare = parseSeatFareInput(body.seatFare);
  if (!parsedFare.ok) return errorResponse(parsedFare.error);

  const breakdown = computePaymentBreakdown(parsedFare.seatPesewas);
  const reference = generatePaystackReference();

  const supabase = getServiceClient();

  const { data: profile, error: profileError } = await supabase
    .from('passenger_profiles')
    .select('device_id')
    .eq('device_id', userId)
    .maybeSingle();

  if (profileError) {
    console.error('[initialize-payment] profile lookup failed:', profileError.message);
    return errorResponse('Could not verify user', 500);
  }
  if (!profile) {
    return errorResponse('Unknown user — create a passenger profile first', 404);
  }

  if (body.reservationId) {
    const { data: reservation, error: resError } = await supabase
      .from('reservations')
      .select('id, passenger_id, status')
      .eq('id', body.reservationId)
      .maybeSingle();

    if (resError) {
      console.error('[initialize-payment] reservation lookup failed:', resError.message);
      return errorResponse('Could not verify reservation', 500);
    }
    if (!reservation) {
      return errorResponse('Reservation not found', 404);
    }
    if (reservation.passenger_id !== userId) {
      return errorResponse('Reservation does not belong to this user', 403);
    }
    if (reservation.status !== 'active') {
      return errorResponse('Reservation is not active', 409);
    }
  }

  const { error: insertError } = await supabase.from('payment_transactions').insert({
    user_id: userId,
    reference,
    amount_in_pesewas: breakdown.amountInPesewas,
    seat_fare: breakdown.seatFareGhs,
    platform_fee: breakdown.platformFeeGhs,
    request_fee: breakdown.requestFeeGhs,
    status: 'pending',
    reservation_id: body.reservationId ?? null,
    metadata: {
      email,
      breakdown,
      source: 'initialize-payment',
    },
  });

  if (insertError) {
    console.error('[initialize-payment] insert failed:', insertError.message);
    return errorResponse('Could not create transaction record', 500);
  }

  try {
    const paystack = await initializePaystackTransaction({
      email,
      amountInPesewas: breakdown.amountInPesewas,
      reference,
      channels: ['mobile_money', 'card'],
      metadata: {
        userId,
        reservationId: body.reservationId ?? null,
        seatFareGhs: breakdown.seatFareGhs,
        platformFeeGhs: breakdown.platformFeeGhs,
        requestFeeGhs: breakdown.requestFeeGhs,
        totalGhs: breakdown.totalGhs,
        amountInPesewas: breakdown.amountInPesewas,
      },
    });

    await supabase
      .from('payment_transactions')
      .update({ paystack_access_code: paystack.accessCode })
      .eq('reference', reference);

    console.log(
      '[initialize-payment] pending',
      reference,
      breakdown.amountInPesewas,
      'pesewas',
      breakdown.totalGhs,
      'GHS',
    );

    return jsonResponse({
      ok: true,
      reference: paystack.reference,
      authorization_url: paystack.authorizationUrl,
      access_code: paystack.accessCode,
      amount_in_pesewas: breakdown.amountInPesewas,
      breakdown: {
        seat_fare: breakdown.seatFareGhs,
        platform_fee: breakdown.platformFeeGhs,
        request_fee: breakdown.requestFeeGhs,
        total: breakdown.totalGhs,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Paystack initialization failed';
    console.error('[initialize-payment] paystack error:', message);

    const { data: existing } = await supabase
      .from('payment_transactions')
      .select('metadata')
      .eq('reference', reference)
      .maybeSingle();

    await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        metadata: {
          ...(typeof existing?.metadata === 'object' && existing.metadata ? existing.metadata : {}),
          paystack_init_error: message,
        },
      })
      .eq('reference', reference);

    return errorResponse(message, 502);
  }
});
