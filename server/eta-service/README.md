# TrotroOS ETA Service

Tiny Express service that sits between the mobile app and any routing API.

## Why it exists

The mobile client **must not** call Google Routes / Mapbox / OSRM directly:

- API keys would leak from APK builds.
- Per-route quotas blow up under heavy realtime usage.
- No way to coalesce identical lookups across users.

This service solves all three:

- API keys stay in the server environment.
- A 60-second in-process cache keyed by `(driver, pickup, route, seats)` rounded to ~110 m precision absorbs bursts (one upstream call per minute per key).
- In-flight deduplication: two requests for the same key trigger exactly one upstream call.

## Endpoints

### `POST /eta`

```json
{
  "driverCoords": { "latitude": 6.685, "longitude": -1.624 },
  "pickupCoords": { "latitude": 6.692, "longitude": -1.611 },
  "routeId":      "adum_kotoko",
  "availableSeats": 8
}
```

Response:

```json
{
  "minMinutes": 5,
  "maxMinutes": 9,
  "distanceKm": 1.8,
  "confidence": "live",
  "label":      "5–9 min"
}
```

Response headers include `x-cache: hit|miss|inflight` for observability.

### `GET /health`

Liveness probe returning `{ ok: true, cacheSize }`.

## Configuration

| Env var                 | Default     | Description                                                                 |
| ----------------------- | ----------- | --------------------------------------------------------------------------- |
| `PORT`                  | `8787`      | Listening port.                                                             |
| `ETA_TTL_MS`            | `60000`     | Cache TTL per key (60 s).                                                   |
| `ETA_CACHE_MAX`         | `5000`      | Max entries before opportunistic eviction of expired rows.                  |
| `ROUTING_PROVIDER`      | `heuristic` | `heuristic` \| `google`. `heuristic` mirrors the local fallback in the app. |
| `GOOGLE_ROUTES_API_KEY` | _(none)_    | Required when `ROUTING_PROVIDER=google`. Use a server-restricted key.       |

## Run locally

```bash
cd server/eta-service
npm install
ROUTING_PROVIDER=heuristic npm start
# → [eta-service] listening on :8787 (provider=heuristic, ttl=60000ms)
```

Then in the app's `constants/config.js`:

```js
export const ETA_SERVICE_URL = 'http://10.0.2.2:8787'; // Android emulator
// or your LAN IP for a physical device
```

The client will automatically use the service for ETA lookups, falling back to its local heuristic if the service is unreachable.

## Deploy

Pick one:

- **Fly.io** — `fly launch --no-deploy && fly deploy` (Node 18+ buildpack).
- **Render** — point at this folder, build cmd `npm install`, start cmd `npm start`.
- **Cloud Run** — `gcloud run deploy --source .` with a small `Dockerfile`.
- **Vercel/Netlify Functions** — copy the Express handler into a serverless function; the in-memory cache becomes per-instance but the 60s TTL still drastically cuts upstream calls.

After deploy, set `ETA_SERVICE_URL` in `constants/config.js` to the public HTTPS URL and rebuild the app.

## Swapping the routing provider

`googleRoutesEta` in `index.js` is the seam. To use Mapbox, OSRM, or your own router, add a new function with the same `(params) => { minMinutes, maxMinutes, distanceKm, confidence, label } | null` contract and dispatch on `ROUTING_PROVIDER` in `computeEta`.
