import { getPaystackSecretKey } from './supabaseAdmin.ts';

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Verify Paystack `x-paystack-signature` HMAC-SHA512 of raw body. */
export async function verifyPaystackSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;

  const secret = getPaystackSecretKey();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );

  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computed = toHex(mac);

  // Constant-time compare
  if (computed.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i += 1) {
    diff |= computed.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

export type PaystackInitResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

export async function initializePaystackTransaction(opts: {
  email: string;
  amountInPesewas: number;
  reference: string;
  metadata: Record<string, unknown>;
  channels?: string[];
}): Promise<PaystackInitResult> {
  const secret = getPaystackSecretKey();

  const resp = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: opts.email,
      amount: opts.amountInPesewas,
      currency: 'GHS',
      reference: opts.reference,
      channels: opts.channels ?? ['mobile_money', 'card'],
      metadata: opts.metadata,
    }),
  });

  const body = await resp.json();
  if (!resp.ok || !body?.status || !body?.data?.authorization_url) {
    const msg = body?.message || `Paystack init failed (${resp.status})`;
    throw new Error(msg);
  }

  return {
    authorizationUrl: body.data.authorization_url,
    accessCode: body.data.access_code,
    reference: body.data.reference ?? opts.reference,
  };
}
