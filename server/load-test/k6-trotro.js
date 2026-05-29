/**
 * k6 load test for TrotroOS.
 *
 * Models a busy Kumasi peak: 100 mates posting position updates and asking
 * for ETAs as they move, plus 500 passengers fetching fare quotes and ETAs
 * for their pickup.
 *
 * Run with:
 *   ETA_SERVICE_URL=... API_BASE_URL=... API_KEY=... k6 run k6-trotro.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const etaErrors = new Rate('eta_errors');
const fareErrors = new Rate('fare_errors');
const etaLatency = new Trend('eta_latency_ms');
const fareLatency = new Trend('fare_latency_ms');

const ETA_URL = __ENV.ETA_SERVICE_URL || 'http://localhost:8787';
const API_URL = __ENV.API_BASE_URL || 'http://localhost:8788';
const API_KEY = __ENV.API_KEY || '';

const KUMASI_CENTRE = { latitude: 6.6885, longitude: -1.6244 };

function jitter(coord, kmRadius = 5) {
  const dLat = (Math.random() - 0.5) * (kmRadius / 111);
  const dLon = (Math.random() - 0.5) * (kmRadius / (111 * Math.cos((coord.latitude * Math.PI) / 180)));
  return { latitude: coord.latitude + dLat, longitude: coord.longitude + dLon };
}

const ROUTES = [
  { origin: 'KNUST',       destination: 'Kumasi City' },
  { origin: 'KNUST',       destination: 'Ayeduase'    },
  { origin: 'Kumasi City', destination: 'Suame'       },
  { origin: 'Kumasi City', destination: 'Tafo'        },
  { origin: 'Kumasi City', destination: 'Adum'        },
];

export const options = {
  scenarios: {
    mates: {
      executor: 'ramping-vus',
      exec: 'mate',
      startVUs: 5,
      stages: [
        { duration: '1m', target: 100 }, // ramp up
        { duration: '4m', target: 100 }, // hold
        { duration: '1m', target: 0   }, // ramp down
      ],
      gracefulStop: '30s',
    },
    passengers: {
      executor: 'ramping-vus',
      exec: 'passenger',
      startVUs: 20,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '4m', target: 500 },
        { duration: '1m', target: 0   },
      ],
      gracefulStop: '30s',
    },
  },
  thresholds: {
    eta_errors: ['rate<0.01'],
    fare_errors: ['rate<0.01'],
    eta_latency_ms: ['p(95)<1500'],
    fare_latency_ms: ['p(95)<800'],
  },
};

export function mate() {
  const driverCoords = jitter(KUMASI_CENTRE, 6);
  const pickupCoords = jitter(driverCoords, 2);
  const res = http.post(
    `${ETA_URL}/eta`,
    JSON.stringify({ driverCoords, pickupCoords, availableSeats: 8 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  etaLatency.add(res.timings.duration);
  etaErrors.add(res.status !== 200);
  check(res, { 'eta 200': (r) => r.status === 200 });
  sleep(5 + Math.random() * 2); // matches the 5s foreground cadence
}

export function passenger() {
  const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];

  const fareRes = http.post(
    `${API_URL}/fares/quote`,
    JSON.stringify(route),
    {
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      },
    },
  );
  fareLatency.add(fareRes.timings.duration);
  fareErrors.add(fareRes.status !== 200);
  check(fareRes, { 'fare 200': (r) => r.status === 200 });

  const pickup = jitter(KUMASI_CENTRE, 8);
  const driver = jitter(pickup, 2);
  const etaRes = http.post(
    `${ETA_URL}/eta`,
    JSON.stringify({ driverCoords: driver, pickupCoords: pickup, availableSeats: 5 }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  etaLatency.add(etaRes.timings.duration);
  etaErrors.add(etaRes.status !== 200);
  check(etaRes, { 'eta 200': (r) => r.status === 200 });

  sleep(8 + Math.random() * 4);
}
