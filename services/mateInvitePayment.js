/**
 * MoMo checkout for mate seat invites (8% of trip fare + GHS 1 request fee).
 */
import { PAYMENTS_ENABLED } from '@/constants/config';
import {
  initMateInvitePayment,
  openPaystackCheckout,
  waitForPaymentConfirmation,
} from '@/services/paymentsApi';

export class MateInvitePaymentError extends Error {
  constructor(message, { status, reference } = {}) {
    super(message);
    this.name = 'MateInvitePaymentError';
    this.status = status;
    this.reference = reference;
  }
}

/**
 * @param {{
 *   mateId: string,
 *   tripId: string,
 *   tripFareGhs: number,
 *   email: string,
 *   passengerId?: string,
 *   onPhase?: (phase: 'initializing' | 'checkout' | 'confirming', detail?: string) => void,
 * }} params
 */
export async function payForMateInvite({
  mateId,
  tripId,
  tripFareGhs,
  email,
  passengerId,
  onPhase,
}) {
  if (!PAYMENTS_ENABLED) {
    return { skipped: true, reference: null };
  }

  const fare = Number(tripFareGhs);
  if (!Number.isFinite(fare) || fare <= 0) {
    throw new MateInvitePaymentError('Set your trip fare before sending paid invites');
  }

  if (!mateId || !tripId) {
    throw new MateInvitePaymentError('Missing trip details for payment');
  }

  const trimmedEmail = email?.trim().toLowerCase();
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new MateInvitePaymentError('Enter a valid email for Mobile Money checkout');
  }

  onPhase?.('initializing');

  const { ok, data, error } = await initMateInvitePayment({
    mateId,
    tripId,
    tripFare: fare,
    email: trimmedEmail,
    passengerId,
  });

  if (!ok || !data?.authorizationUrl) {
    throw new MateInvitePaymentError(error?.message ?? 'Could not start payment');
  }

  onPhase?.('checkout');
  await openPaystackCheckout(data.authorizationUrl);

  onPhase?.('confirming');
  const { status, payment } = await waitForPaymentConfirmation(data.reference, {
    onTick: (s) => onPhase?.('confirming', s),
  });

  if (status === 'success') {
    return {
      skipped: false,
      reference: data.reference,
      breakdown: data.breakdown,
      payment,
    };
  }

  if (status === 'timeout') {
    throw new MateInvitePaymentError(
      'Payment is still processing. Check your MoMo prompt or try again shortly.',
      { status, reference: data.reference },
    );
  }

  throw new MateInvitePaymentError(
    status === 'failed' ? 'Payment failed or was cancelled' : 'Payment was not completed',
    { status, reference: data.reference },
  );
}
