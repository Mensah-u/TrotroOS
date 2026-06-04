# Deploy TrotroOS web app (passenger booking)

Host the Expo web export at **trotroos.com** or any static host.

## 1. Google Maps (web)

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs → enable **Maps JavaScript API**.
2. Create an API key restricted by **HTTP referrers**:
   - `http://localhost:*/*` (dev)
   - `https://trotroos.com/*`
   - `https://*.vercel.app/*` (if using Vercel previews)
3. Add to `.env` or hosting env:

```env
EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY=your-javascript-api-key
```

Also set Supabase vars (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).

## 2. Build locally

```powershell
cd C:\Users\HP\Documents\TrotroOSv2
npm install
npm run build:web
npm run preview:web
```

Output folder: `dist/` (contains `index.html` + JS bundle).

## 3. Deploy to Vercel (recommended)

1. Push repo to GitHub.
2. Import project at [vercel.com](https://vercel.com) → root directory = repo root.
3. Vercel reads `vercel.json` automatically.
4. Add environment variables in Vercel → Settings → Environment Variables:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `EXPO_PUBLIC_GOOGLE_MAPS_WEB_KEY`
   - `EXPO_PUBLIC_PRIVACY_POLICY_URL`
5. Deploy. Point **trotroos.com** DNS to Vercel (A/CNAME records).

## 4. Deploy to Netlify

1. Connect GitHub repo at [netlify.com](https://netlify.com).
2. Build settings are in `netlify.toml`.
3. Add the same `EXPO_PUBLIC_*` env vars in Netlify → Site settings → Environment.
4. Custom domain: trotroos.com → Netlify DNS.

## 5. GitHub Actions (optional)

Workflow `.github/workflows/deploy-web.yml` builds on push to `master` and uploads `dist/` as an artifact.

## Web vs Android

| Feature | Web | Android app |
|---------|-----|-------------|
| Passenger booking | Yes | Yes |
| Live map | Google Maps JS | Google Maps native |
| Mate dashboard | No (use Android) | Yes |
| Push notifications | No | Yes (APK) |

## Supabase auth (web)

Add your production URL to Supabase → Authentication → URL Configuration:

- `https://trotroos.com`
- `https://www.trotroos.com`
