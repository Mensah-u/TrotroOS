# TrotroOS API service

Authoritative server for the bits we don't trust the client with:

| Endpoint                       | What it does                                                 |
| ------------------------------ | ------------------------------------------------------------ |
| `GET  /health`                 | liveness probe                                               |
| `GET  /config`                 | Paystack public key + currency (so we don't bake it in)      |
| `POST /fares/quote`            | Fare in GHS for a route / origin-destination pair            |
| `POST /payments/init`          | Initialises a Paystack transaction with a **server** amount  |
| `GET  /payments/:reference`    | Current payment status (the client polls this after redirect)|
| `GET  /wallet/:userId`         | Server-computed wallet balance                               |
| `GET  /wallet/:userId/ledger`  | Wallet ledger (last 50 entries)                              |
| `POST /webhooks/paystack`      | HMAC-verified, idempotent webhook handler                    |

All endpoints except the webhook require `x-api-key`. The webhook is verified
via the `X-Paystack-Signature` HMAC header.

## Deploy

```bash
cd server/api
cp .env.example .env   # then fill in the real keys
npm install
npm start
```

Recommended hosts: Cloud Run, Fly.io, Render, Railway. Any Node 18+ runtime.

Then point the mobile app at it via `EXPO_PUBLIC_API_URL` and
`EXPO_PUBLIC_API_KEY` (see `constants/config.js`).

## Paystack webhook setup

1. Open your Paystack dashboard → Settings → API Keys & Webhooks.
2. Add `https://<your-host>/webhooks/paystack` as the webhook URL.
3. Save. The `X-Paystack-Signature` HMAC is automatic.
4. Test with Paystack's "Test webhook" button — you should see one
   `webhook_events` row in Supabase and (for `charge.success`) an updated
   `payments` row.

## Idempotency

Every webhook delivery inserts into `webhook_events` first with a unique
`(provider, event_id)` constraint. A duplicate event hits the `23505`
unique-violation path and returns early **before** any wallet/reservation
side effects run, so Paystack retries never double-credit.
