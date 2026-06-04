/**
 * Client-side payment breakdown (display only — server is authoritative).
 * Mirrors supabase/functions/_shared/paymentMath.ts
 */

export const REQUEST_FEE_PESEWAS = 100;
export const PLATFORM_FEE_BPS = 800;

export function parseSeatFareInput(input) {
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

export function computePaymentBreakdown(seatPesewas) {
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

export function pesewasToGhsString(pesewas) {
  const abs = Math.abs(pesewas);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${pesewas < 0 ? '-' : ''}${whole}.${frac}`;
}

/** UI helper: estimate total from seat fare in GHS. */
export function estimatePaymentTotal(seatFare) {
  const parsed = parseSeatFareInput(seatFare);
  if (!parsed.ok) return null;
  return computePaymentBreakdown(parsed.seatPesewas);
}

/**
 * Mate seat-invite fee: platform 8% of trip fare + GHS 1 request fee (no seat charge).
 * Mirrors computeMateInviteBreakdown in supabase/functions/_shared/paymentMath.ts
 */
export function computeMateInviteBreakdown(tripFarePesewas) {
  const platformPesewas = Math.round((tripFarePesewas * PLATFORM_FEE_BPS) / 10_000);
  const requestPesewas = REQUEST_FEE_PESEWAS;
  const amountInPesewas = platformPesewas + requestPesewas;
  return {
    tripFarePesewas,
    platformPesewas,
    requestPesewas,
    amountInPesewas,
    tripFareGhs: pesewasToGhsString(tripFarePesewas),
    platformFeeGhs: pesewasToGhsString(platformPesewas),
    requestFeeGhs: pesewasToGhsString(requestPesewas),
    totalGhs: pesewasToGhsString(amountInPesewas),
  };
}

/** UI helper: mate invite MoMo total from trip fare in GHS. */
export function estimateMateInviteFee(tripFare) {
  const parsed = parseSeatFareInput(tripFare);
  if (!parsed.ok) return null;
  return computeMateInviteBreakdown(parsed.seatPesewas);
}
