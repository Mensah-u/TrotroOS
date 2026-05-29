# Scaling TrotroOS for launch

Before you flip the "open to anyone in Kumasi" switch.

## Supabase

- **Pro tier ($25/mo)** unlocks 500 concurrent realtime connections,
  point-in-time recovery, 100 k MAUs, and 8 GB of database.
- Pro is required if you expect >200 simultaneously online users (free
  cap). Run `npm --prefix server/load-test run stress` against the live
  project to confirm headroom *before* a launch week.
- Enable [database backups](https://supabase.com/docs/guides/platform/backups)
  and set point-in-time recovery to 7 days.

## Firebase (only if you adopt Crashlytics / FCM later)

- **Blaze plan** (pay-as-you-go) is required for any production-grade
  Firebase usage. Set a **budget alert** at $20/mo, $50/mo, $100/mo
  thresholds. The first $25 of usage each month is free.

## Paystack

- Switch your keys from `sk_test_…` to `sk_live_…`.
- Configure the production webhook URL `https://api.trotroos.com/webhooks/paystack`.
- Turn on webhook retry logging in the dashboard.

## Monitoring

- Wire **Sentry** or **Crashlytics** by installing the respective package
  — `services/monitoring.js` auto-detects them.
- Add Google Cloud / Supabase budget alerts at 50%, 80%, 100% of monthly
  spend.

## Load testing cadence

| Cadence            | Tool                                  | Threshold                |
| ------------------ | ------------------------------------- | ------------------------ |
| Before every release | `k6 run server/load-test/k6-trotro.js` | < 1% errors, p95 < 1500ms|
| Weekly             | `node server/load-test/node-realtime-stress.js` | < 5% connection failures |
| Pre-launch         | Both, simulated for 30 mins             | No 5xx, no DB CPU > 60%  |
