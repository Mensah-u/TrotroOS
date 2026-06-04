import {
  REQUEST_FEE_PESEWAS,
  PLATFORM_FEE_BPS,
  computeMateInviteBreakdown,
  computePaymentBreakdown,
  parseSeatFareInput,
  pesewasToGhsString,
} from '../utils/paymentMath';

describe('paymentMath', () => {
  test('parseSeatFareInput rejects invalid values', () => {
    expect(parseSeatFareInput(null).ok).toBe(false);
    expect(parseSeatFareInput(-5).ok).toBe(false);
    expect(parseSeatFareInput('abc').ok).toBe(false);
    expect(parseSeatFareInput('10.999').ok).toBe(false);
  });

  test('parseSeatFareInput accepts up to 2 decimal places', () => {
    expect(parseSeatFareInput('10').ok).toBe(true);
    expect(parseSeatFareInput('10.5').ok).toBe(true);
    expect(parseSeatFareInput(12.34).ok).toBe(true);
  });

  test('computePaymentBreakdown: 10 GHS seat → 11.80 GHS total', () => {
    const b = computePaymentBreakdown(1000);
    expect(b.seatFareGhs).toBe('10.00');
    expect(b.platformFeeGhs).toBe('0.80');
    expect(b.requestFeeGhs).toBe('1.00');
    expect(b.totalGhs).toBe('11.80');
    expect(b.amountInPesewas).toBe(1180);
  });

  test('computePaymentBreakdown uses integer pesewas (no float drift)', () => {
    const b = computePaymentBreakdown(333); // 3.33 GHS
    expect(b.platformPesewas).toBe(Math.round(333 * PLATFORM_FEE_BPS / 10_000));
    expect(b.amountInPesewas).toBe(333 + b.platformPesewas + REQUEST_FEE_PESEWAS);
  });

  test('pesewasToGhsString formats correctly', () => {
    expect(pesewasToGhsString(1180)).toBe('11.80');
    expect(pesewasToGhsString(100)).toBe('1.00');
    expect(pesewasToGhsString(5)).toBe('0.05');
  });

  test('computeMateInviteBreakdown: 4 GHS fare → 1.32 GHS invite fee', () => {
    const b = computeMateInviteBreakdown(400);
    expect(b.tripFareGhs).toBe('4.00');
    expect(b.platformFeeGhs).toBe('0.32');
    expect(b.requestFeeGhs).toBe('1.00');
    expect(b.totalGhs).toBe('1.32');
    expect(b.amountInPesewas).toBe(132);
  });
});
