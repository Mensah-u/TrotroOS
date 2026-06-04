/**
 * Exact payment breakdown for TrotroOS Paystack charges.
 * All amounts in integer pesewas to avoid floating-point drift.
 */

export const REQUEST_FEE_PESEWAS = 100; // 1 GHS
export const PLATFORM_FEE_BPS = 800; // 8% = 800 basis points

export type PaymentBreakdown = {
  seatFareGhs: string;
  platformFeeGhs: string;
  requestFeeGhs: string;
  totalGhs: string;
  seatPesewas: number;
  platformPesewas: number;
  requestPesewas: number;
  amountInPesewas: number;
};

/** Parse seat fare from client input; rejects invalid / non-positive values. */
export function parseSeatFareInput(input: unknown): { ok: true; seatPesewas: number } | { ok: false; error: string } {
  if (input === null || input === undefined) {
    return { ok: false, error: 'seatFare is required' };
  }

  const raw = typeof input === 'string' ? input.trim() : String(input);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    return { ok: false, error: 'seatFare must be a positive amount with at most 2 decimal places' };
  }

  const [whole, frac = ''] = raw.split('.');
  const pesewas = Number(whole) * 100 + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(pesewas) || pesewas <= 0) {
    return { ok: false, error: 'seatFare must be greater than 0' };
  }

  return { ok: true, seatPesewas: pesewas };
}

/** platform_fee = round(seat × 8%); request_fee = 1 GHS; total in pesewas. */
export function computePaymentBreakdown(seatPesewas: number): PaymentBreakdown {
  const platformPesewas = Math.round((seatPesewas * PLATFORM_FEE_BPS) / 10_000);
  const requestPesewas = REQUEST_FEE_PESEWAS;
  const amountInPesewas = seatPesewas + platformPesewas + requestPesewas;

  return {
    seatPesewas,
    platformPesewas,
    requestPesewas,
    amountInPesewas,
    seatFareGhs: pesewasToGhsString(seatPesewas),
    platformFeeGhs: pesewasToGhsString(platformPesewas),
    requestFeeGhs: pesewasToGhsString(requestPesewas),
    totalGhs: pesewasToGhsString(amountInPesewas),
  };
}

export function pesewasToGhsString(pesewas: number): string {
  const sign = pesewas < 0 ? '-' : '';
  const abs = Math.abs(pesewas);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

/** Mate seat-invite: 8% of trip fare + GHS 1 (driver does not pay the passenger seat fare). */
export function computeMateInviteBreakdown(tripFarePesewas: number): PaymentBreakdown & {
  tripFarePesewas: number;
  tripFareGhs: string;
} {
  const platformPesewas = Math.round((tripFarePesewas * PLATFORM_FEE_BPS) / 10_000);
  const requestPesewas = REQUEST_FEE_PESEWAS;
  const amountInPesewas = platformPesewas + requestPesewas;

  return {
    tripFarePesewas,
    tripFareGhs: pesewasToGhsString(tripFarePesewas),
    seatPesewas: tripFarePesewas,
    platformPesewas,
    requestPesewas,
    amountInPesewas,
    seatFareGhs: pesewasToGhsString(tripFarePesewas),
    platformFeeGhs: pesewasToGhsString(platformPesewas),
    requestFeeGhs: pesewasToGhsString(requestPesewas),
    totalGhs: pesewasToGhsString(amountInPesewas),
  };
}

export function generatePaystackReference(prefix = 'trotro'): string {
  const stamp = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}_${stamp}_${rand}`;
}
