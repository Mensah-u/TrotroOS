import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

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

type InitBody = {
  userId?: string;
  seatFare?: number | string;
  email?: string;
  reservationId?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  let body: InitBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const userId = body.userId?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!userId) return errorResponse('userId is required');
  if (!email || !EMAIL_RE.test(email)) return errorResponse('A valid email is required');

  const parsedFare = parseSeatFareInput(body.seatFare);
  if (!parsedFare.ok) return errorResponse(parsedFare.error);

  const breakdown = computePaymentBreakdown(parsedFare.seatPesewas);
  const reference = generatePaystackReference();

  const supabase = getServiceClient();

  // Ensure passenger profile exists (device_id = userId)
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
      },
    });

    await supabase
      .from('payment_transactions')
      .update({ paystack_access_code: paystack.accessCode })
      .eq('reference', reference);

    console.log('[initialize-payment] pending', reference, breakdown.amountInPesewas, 'pesewas');

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

    await supabase
      .from('payment_transactions')
      .update({ status: 'failed', metadata: { email, breakdown, error: message } })
      .eq('reference', reference);

    return errorResponse(message, 502);
  }
});
