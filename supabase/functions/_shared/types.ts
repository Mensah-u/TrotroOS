/** Paystack webhook payload (subset we use). */
export type PaystackWebhookEvent = {
  event?: string;
  data?: {
    id?: number | string;
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    metadata?: Record<string, unknown>;
  };
};

export type InitializePaymentBody = {
  userId?: string;
  seatFare?: number | string;
  email?: string;
  reservationId?: string;
};

export type PaymentTransactionRow = {
  id: string;
  user_id: string;
  reference: string;
  amount_in_pesewas: number;
  seat_fare: string;
  platform_fee: string;
  request_fee: string;
  status: 'pending' | 'success' | 'failed';
  reservation_id: string | null;
  metadata: Record<string, unknown>;
};
