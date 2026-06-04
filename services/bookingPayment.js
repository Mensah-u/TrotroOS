/**
 * MoMo/card checkout for seat reservations via Paystack Edge Functions.
 */
import { PAYMENTS_ENABLED } from '@/constants/config';
import {
  initPayment,
  openPaystackCheckout,
  waitForPaymentConfirmation,
} from '@/services/paymentsApi';
import { isValidPaymentEmail } from '@/services/passengerPaymentEmail';

export class BookingPaymentError extends Error {
  constructor(message, { status, reference } = {}) {
    super(message);
    this.name = 'BookingPaymentError';
    this.status = status;
    this.reference = reference;
  }
}

/**
 * @param {{
 *   userId: string,
 *   seatFareGhs: number,
 *   email: string,
 *   reservationId: string,
 *   onPhase?: (phase: 'initializing' | 'checkout' | 'confirming', detail?: string) => void,
 * }} params
 */
export async function payForReservation({
  userId,
  seatFareGhs,
  email,
  reservationId,
  onPhase,
}) {
  if (!PAYMENTS_ENABLED) {
    return { skipped: true, reference: null };
  }

  if (!userId || !reservationId) {
    throw new BookingPaymentError('Missing booking details for payment');
  }

  const fare = Number(seatFareGhs);
  if (!Number.isFinite(fare) || fare <= 0) {
    throw new BookingPaymentError('This trip has no fare set — payment cannot be calculated');
  }

  if (!isValidPaymentEmail(email)) {
    throw new BookingPaymentError('Enter a valid email for Mobile Money checkout');
  }

  onPhase?.('initializing');

  const { ok, data, error } = await initPayment({
    userId,
    seatFare: fare,
    email: email.trim().toLowerCase(),
    reservationId,
  });

  if (!ok || !data?.authorizationUrl) {
    throw new BookingPaymentError(error?.message ?? 'Could not start payment');
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
    throw new BookingPaymentError(
      'Payment is still processing. Check your MoMo prompt or try again shortly.',
      { status, reference: data.reference },
    );
  }

  throw new BookingPaymentError(
    status === 'failed' ? 'Payment failed or was cancelled' : 'Payment was not completed',
    { status, reference: data.reference },
  );
}
