# Production launch — remaining manual steps

Everything in code/CI is wired. Complete these **once** before Play Store production.

## 1. Sentry — done

- **DSN** in `.env` (`EXPO_PUBLIC_SENTRY_DSN`)
- **Auth token** in `.env` (`SENTRY_AUTH_TOKEN`) and EAS (production + preview)
- **Org:** `trotroos` · **Project:** `react-native`

Rebuild to upload source maps on the next EAS build:

```powershell
npm run build:aab:eas
```

## 2. Host privacy policy

The static page lives at `public/privacy.html`. It is copied to `dist/privacy.html` on `npm run build:web`.

Deploy web to **trotroos.com** (Vercel/Netlify — see `docs/WEB_DEPLOY.md`). Verify:

```
https://trotroos.com/privacy
```

returns 200 on mobile.

## 3. Supabase production

Apply all SQL in order: `supabase/DEPLOY_ORDER.md`

Run load test before open launch: `docs/SCALE_UP.md`

## 4. Play Store

```powershell
npm run check:release   # should pass (Sentry warning OK until DSN set)
npm run build:aab:eas
```

Upload AAB → **Internal testing** → real Kumasi mates → 14-day closed track → production.

## 5. After code changes

Restart Metro with a clean cache if you see stale runtime errors:

```powershell
npm run start:clean
```
