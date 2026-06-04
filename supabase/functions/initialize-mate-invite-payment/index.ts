import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { verifyUserAccess } from '../_shared/auth.ts';
import {
  computeMateInviteBreakdown,
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  mateId?: string;
  tripId?: string;
  tripFare?: number | string;
  email?: string;
  passengerId?: string;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  const mateId = body.mateId?.trim();
  const tripId = body.tripId?.trim();
  const email = body.email?.trim().toLowerCase();
  const passengerId = body.passengerId?.trim() ?? null;

  if (!mateId) return errorResponse('mateId is required');
  if (!tripId || !UUID_RE.test(tripId)) return errorResponse('tripId must be a valid UUID');
  if (!email || !EMAIL_RE.test(email)) return errorResponse('A valid email is required');

  const accessError = await verifyUserAccess(req, mateId, async (token) => {
    const supabase = getServiceClient();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return { user: null };
    return { user: data.user };
  });
  if (accessError) {
    console.error('[initialize-mate-invite-payment] auth failed:', accessError);
    return errorResponse(accessError, 403);
  }

  const parsedFare = parseSeatFareInput(body.tripFare);
  if (!parsedFare.ok) return errorResponse(parsedFare.error);

  const breakdown = computeMateInviteBreakdown(parsedFare.seatPesewas);
  const reference = generatePaystackReference('mate_invite');

  const supabase = getServiceClient();

  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select('id, mate_id, status, available_seats, fare_ghs')
    .eq('id', tripId)
    .maybeSingle();

  if (tripError) {
    console.error('[initialize-mate-invite-payment] trip lookup failed:', tripError.message);
    return errorResponse('Could not verify trip', 500);
  }
  if (!trip) return errorResponse('Trip not found', 404);
  if (trip.mate_id !== mateId) {
    return errorResponse('Trip does not belong to this mate', 403);
  }
  if (!['active', 'full'].includes(trip.status) || (trip.available_seats ?? 0) <= 0) {
    return errorResponse('Trip has no seats available', 409);
  }

  const { error: insertError } = await supabase.from('payment_transactions').insert({
    user_id: mateId,
    reference,
    amount_in_pesewas: breakdown.amountInPesewas,
    seat_fare: breakdown.tripFareGhs,
    platform_fee: breakdown.platformFeeGhs,
    request_fee: breakdown.requestFeeGhs,
    status: 'pending',
    payment_kind: 'mate_invite',
    trip_id: tripId,
    reservation_id: null,
    metadata: {
      email,
      payment_kind: 'mate_invite',
      trip_id: tripId,
      passenger_id: passengerId,
      breakdown,
      source: 'initialize-mate-invite-payment',
    },
  });

  if (insertError) {
    console.error('[initialize-mate-invite-payment] insert failed:', insertError.message);
    return errorResponse('Could not create transaction record', 500);
  }

  try {
    const paystack = await initializePaystackTransaction({
      email,
      amountInPesewas: breakdown.amountInPesewas,
      reference,
      channels: ['mobile_money', 'card'],
      metadata: {
        mateId,
        tripId,
        passengerId,
        paymentKind: 'mate_invite',
        tripFareGhs: breakdown.tripFareGhs,
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

    return jsonResponse({
      ok: true,
      reference: paystack.reference,
      authorization_url: paystack.authorizationUrl,
      access_code: paystack.accessCode,
      amount_in_pesewas: breakdown.amountInPesewas,
      breakdown: {
        trip_fare: breakdown.tripFareGhs,
        platform_fee: breakdown.platformFeeGhs,
        request_fee: breakdown.requestFeeGhs,
        total: breakdown.totalGhs,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Paystack initialization failed';
    console.error('[initialize-mate-invite-payment] paystack error:', message);

    await supabase
      .from('payment_transactions')
      .update({ status: 'failed' })
      .eq('reference', reference);

    return errorResponse(message, 502);
  }
});
