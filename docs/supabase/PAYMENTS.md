# Paystack Mobile Money — Supabase Edge Functions

Secure seat-booking payments for **TrotroOS**. All fee math runs on the **server** — the mobile client never sends a trusted total.

## Fee model

| Component | Rule |
|-----------|------|
| Seat fare | Sent by client as a hint only; stored as `numeric(12,2)` |
| Platform fee | **8%** of seat fare (`round(seat_pesewas × 800 / 10_000)`) |
| Request fee | **1 GHS** flat (100 pesewas) |

### Mate seat invite (driver → passenger)

When a mate sends a **seat invite** to a waiting passenger:

| Component | Amount |
|-----------|--------|
| Platform fee | **8%** of the trip fare (not the full seat price) |
| Request fee | **1 GHS** flat |
| **Total charged to mate** | `round(trip_fare × 8%) + 1 GHS` |

Example: trip fare **GHS 4.00** → invite fee **GHS 1.32** (0.32 + 1.00).

Edge function: `initialize-mate-invite-payment`. RPC `send_mate_ride_request` requires a successful `payment_reference` when payments are enforced.
| **Total** | seat + platform + request |
| Paystack charge | **integer pesewas** (`total_ghs × 100`) |

**Example:** seat **10.00 GHS** → platform **0.80** + request **1.00** → total **11.80 GHS** → **1180** pesewas.

Implementation: `supabase/functions/_shared/paymentMath.ts` (authoritative) and `utils/paymentMath.js` (display-only mirror).

---

## 1. Database migrations

Run in [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql/new), in order:

```text
supabase/migrations/007_payment_transactions.sql
supabase/migrations/008_payment_reservation_link.sql
```

**`payment_transactions` columns**

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `user_id` | text | FK → `passenger_profiles.device_id` |
| `reference` | text | Unique Paystack reference |
| `amount_in_pesewas` | integer | Total charged |
| `seat_fare` | numeric(12,2) | GHS |
| `platform_fee` | numeric(12,2) | GHS (8%) |
| `request_fee` | numeric(12,2) | GHS (default 1.00) |
| `status` | enum | `pending`, `success`, `failed` |
| `created_at` / `updated_at` | timestamptz | Auto |

Requires `passenger_profiles` and `webhook_events` (from `FIX_payments_and_wallet.sql` if not already applied).

---

## 2. Environment variables / secrets

**Never commit real keys.** Use Supabase Dashboard secrets for production.

### Supabase Edge Function secrets

Dashboard → **Project Settings → Edge Functions → Secrets**

| Secret | Required | Description |
|--------|----------|-------------|
| `PAYSTACK_SECRET_KEY` | **Yes** | `sk_test_…` or `sk_live_…` from [Paystack Developer Settings](https://dashboard.paystack.com/#/settings/developer) |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically at runtime.

### Set via CLI

```powershell
cd C:\Users\HP\Documents\TrotroOSv2
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxxxxxxx
```

### Local serve (optional)

Copy `supabase/functions/.env.example` → `supabase/functions/.env` and fill in test keys:

```env
PAYSTACK_SECRET_KEY=sk_test_REPLACE_ME
```

Also export `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from your project settings when serving locally.

---

## 3. Deploy Edge Functions

```powershell
npm run deploy:paystack
# or manually:
supabase functions deploy initialize-payment
supabase functions deploy paystack-webhook --no-verify-jwt
```

| Function | JWT | Purpose |
|----------|-----|---------|
| `initialize-payment` | Yes (anon + device header) | Calculate fees, call Paystack init, store `pending` row |
| `paystack-webhook` | **No** (`--no-verify-jwt`) | HMAC-verified Paystack callbacks only |

---

## 4. Paystack webhook URL

Paystack Dashboard → **Settings → Webhooks**:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/paystack-webhook
```

Subscribe to: **`charge.success`**, **`charge.failed`**.

Security: every request is verified with HMAC-SHA512 using `x-paystack-signature` and `PAYSTACK_SECRET_KEY`.

---

## 5. Expo client usage

```javascript
import * as WebBrowser from 'expo-web-browser';
import { initPayment, waitForPaymentConfirmation } from '@/services/paymentsApi';
import { getOrCreateDeviceId } from '@/services/passengerProfile';

const deviceId = await getOrCreateDeviceId();

const { ok, data, error } = await initPayment({
  userId: deviceId,
  seatFare: 10.0,              // GHS — server recalculates total
  email: 'passenger@example.com',
  reservationId: reservation.id, // optional UUID
});

if (!ok) throw new Error(error.message);

await WebBrowser.openBrowserAsync(data.authorizationUrl);

const { status } = await waitForPaymentConfirmation(data.reference);
if (status === 'success') {
  // payment_transactions.status === 'success'
  // reservations.payment_reference set when reservationId was passed
}
```

The Supabase client must send `x-device-id` (already wired in `services/supabase.js` via `setSupabaseDeviceId`).

---

## 6. API reference

### `POST /functions/v1/initialize-payment`

**Headers:** `Authorization: Bearer <anon-or-user-jwt>`, `x-device-id: <deviceId>` (must match `userId`)

**Body**

```json
{
  "userId": "device-uuid",
  "seatFare": 10.0,
  "email": "passenger@example.com",
  "reservationId": "optional-reservation-uuid"
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

Called by Paystack only. Verifies signature, idempotency via `webhook_events`, updates `payment_transactions` to `success` or `failed`, validates amount matches, links `reservations.payment_reference`.

---

## 7. Monitoring

Edge Function logs (Supabase Dashboard → Edge Functions → Logs):

- `[initialize-payment] pending …`
- `[paystack-webhook] success …`
- `[paystack-webhook] amount mismatch …` (tamper attempt)
- `[paystack-webhook] invalid x-paystack-signature`

---

## 8. Tests

```powershell
npm test -- paymentMath
```
