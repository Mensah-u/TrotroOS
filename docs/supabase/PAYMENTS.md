# Paystack Mobile Money — Supabase Edge Functions

Secure seat-booking payments for TrotroOS. **All fee math runs on the server** — the client never sends a trusted total.

## Fee model

| Component | Rule |
|-----------|------|
| Seat fare | Provided by client as hint; stored as `numeric(12,2)` |
| Platform fee | **8%** of seat fare |
| Request fee | **1 GHS** flat |
| **Total** | seat + platform + request |
| Paystack amount | `total × 100` pesewas (integer) |

Example: seat **10.00 GHS** → platform **0.80** + request **1.00** → total **11.80 GHS** → **1180** pesewas.

## 1. Database migration

Run in [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new):

```text
supabase/migrations/007_payment_transactions.sql
```

Requires `passenger_profiles` (from `FIX_passenger_profiles_and_reservations.sql`) and `webhook_events` (from `FIX_payments_and_wallet.sql`).

## 2. Edge Function secrets

Dashboard → **Project Settings → Edge Functions → Secrets**:

| Secret | Value |
|--------|--------|
| `PAYSTACK_SECRET_KEY` | `sk_test_…` or `sk_live_…` from [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions.

## 3. Deploy functions

Install [Supabase CLI](https://supabase.com/docs/guides/cli), link your project, then:

```powershell
cd C:\Users\HP\Documents\TrotroOSv2
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx
supabase functions deploy initialize-payment
supabase functions deploy paystack-webhook --no-verify-jwt
```

## 4. Paystack webhook URL

In Paystack Dashboard → **Settings → Webhooks**, set:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook
```

Events: `charge.success`, `charge.failed`.

## 5. Mobile client

```javascript
import { initPayment, waitForPaymentConfirmation } from '@/services/paymentsApi';

const { ok, data } = await initPayment({
  userId: deviceId,       // passenger_profiles.device_id
  seatFare: 10.0,         // GHS — server recalculates total
  email: 'user@example.com',
  reservationId: '…',     // optional
});

if (ok) {
  // Open data.authorizationUrl in WebBrowser for MoMo
  await waitForPaymentConfirmation(data.reference);
}
```

## API reference

### `POST /functions/v1/initialize-payment`

**Body**

```json
{
  "userId": "device-uuid",
  "seatFare": 10.0,
  "email": "passenger@example.com",
  "reservationId": "optional-uuid"
}
```

**Response**

```json
{
  "ok": true,
  "reference": "trotro_…",
  "authorization_url": "https://checkout.paystack.com/…",
  "access_code": "…",
  "amount_in_pesewas": 1180,
  "breakdown": {
    "seat_fare": "10.00",
    "platform_fee": "0.80",
    "request_fee": "1.00",
    "total": "11.80"
  }
}
```

### `POST /functions/v1/paystack-webhook`

Called by Paystack only. Verifies `x-paystack-signature` with `PAYSTACK_SECRET_KEY`.

## Local testing

```powershell
supabase functions serve initialize-payment --env-file supabase/functions/.env
```

Use Paystack test keys and [test MoMo numbers](https://paystack.com/docs/payments/test-payments).

## Legacy Express API

`server/api/index.js` remains for self-hosted deployments. New installs should prefer Edge Functions.
