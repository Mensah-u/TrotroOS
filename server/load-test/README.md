# TrotroOS load test

Two scripts in this folder. Pick whichever you have tooling for.

| File                     | Tool   | What it does                                                            |
| ------------------------ | ------ | ----------------------------------------------------------------------- |
| `k6-trotro.js`           | k6     | 500 virtual passengers + 100 virtual mates against ETA service + REST   |
| `node-realtime-stress.js`| Node   | Spawns N concurrent Supabase Realtime subscribers to test connection caps |

## 1) k6 — REST + ETA service

Install once: <https://k6.io/docs/get-started/installation/>

```bash
# Required env vars
export ETA_SERVICE_URL=https://eta.trotro.os   # or http://localhost:8787
export API_BASE_URL=https://api.trotro.os      # or http://localhost:8788
export API_KEY=replace-with-server-api-key

k6 run server/load-test/k6-trotro.js
```

Defaults match the brief:
- 100 drivers ramping up over 1 min
- 500 passengers ramping up over 2 min
- Total run time ~7 min
- Each VU issues `/eta` + `/fares/quote` requests at a realistic cadence

Pass criteria baked in:
- `http_req_failed{status:!200}` < 1%
- p95 latency < 1 500 ms (ETA path) and < 800 ms (fares path)

## 2) Node — Supabase Realtime stress

For Realtime, k6 is awkward (no WebSocket-with-auth helper). The Node script
opens N Supabase channels in parallel and reports how many stay subscribed.

```bash
cd server/load-test
npm install
SUPABASE_URL=... SUPABASE_ANON_KEY=... CONNECTIONS=600 node node-realtime-stress.js
```

> **Watch your free-tier limits.** Supabase free tier caps concurrent realtime
> connections (currently 200). If this script reports many `closed` events you
> have hit the cap and need to upgrade (see `docs/SCALE_UP.md`).
