// Anchor coordinates around the KNUST corridor.
const TECH_JUNCTION = { latitude: 6.673, longitude: -1.565 };
const AYEDUASE = { latitude: 6.68, longitude: -1.56 };

const STEP_DISTANCE = 0.0003;      // ≈ 33m per tick (3s) — trotro-ish speed
const POSITION_JITTER = 0.00005;   // tiny random nudge so movement looks alive

function jitter(amount = POSITION_JITTER) {
  return (Math.random() - 0.5) * amount * 2;
}

function bearing(from, to) {
  const dLat = to.latitude - from.latitude;
  const dLng = to.longitude - from.longitude;
  return ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
}

function distance(a, b) {
  return Math.hypot(b.latitude - a.latitude, b.longitude - a.longitude);
}

// Build a vehicle positioned at a fraction `t` (0..1) along the
// Tech Junction → Ayeduase corridor.
function spawnAt(t) {
  return {
    latitude: TECH_JUNCTION.latitude + (AYEDUASE.latitude - TECH_JUNCTION.latitude) * t + jitter(0.0002),
    longitude: TECH_JUNCTION.longitude + (AYEDUASE.longitude - TECH_JUNCTION.longitude) * t + jitter(0.0002),
    heading: bearing(TECH_JUNCTION, AYEDUASE),
  };
}

export function getSimulatedVehicles() {
  return [
    {
      id: 'v1',
      route: 'Tech Junction → Ayeduase',
      originStation: 'Tech Junction',
      destination: 'Ayeduase',
      departureTime: '3 min',
      fare: 'GHS 3',
      availableSeats: 5,
      ...spawnAt(0.15),
    },
    {
      id: 'v2',
      route: 'Tech Junction → Ayeduase',
      originStation: 'Tech Junction',
      destination: 'Ayeduase',
      departureTime: '1 min',
      fare: 'GHS 3',
      availableSeats: 12,
      ...spawnAt(0.05),
    },
    {
      id: 'v3',
      route: 'Tech Junction → Ayeduase',
      originStation: 'Tech Junction',
      destination: 'Ayeduase',
      departureTime: '6 min',
      fare: 'GHS 3',
      availableSeats: 3,
      ...spawnAt(0.55),
    },
    {
      id: 'v4',
      route: 'Tech Junction → Ayeduase',
      originStation: 'Tech Junction',
      destination: 'Ayeduase',
      departureTime: '12 min',
      fare: 'GHS 3',
      availableSeats: 0,
      ...spawnAt(0.85),
    },
    {
      id: 'v5',
      route: 'Tech Junction → Ayeduase',
      originStation: 'Tech Junction',
      destination: 'Ayeduase',
      departureTime: '4 min',
      fare: 'GHS 3',
      availableSeats: 8,
      ...spawnAt(0.35),
    },
  ];
}

// Move a vehicle one step toward Ayeduase. If it gets close to the
// destination, respawn it near Tech Junction so the loop continues.
export function stepVehicle(vehicle) {
  const target = AYEDUASE;
  const dist = distance(vehicle, target);
  if (dist < 0.0008) {
    return {
      ...vehicle,
      ...spawnAt(0.02),
    };
  }
  const dLat = target.latitude - vehicle.latitude;
  const dLng = target.longitude - vehicle.longitude;
  const nextLat = vehicle.latitude + (dLat / dist) * STEP_DISTANCE + jitter();
  const nextLng = vehicle.longitude + (dLng / dist) * STEP_DISTANCE + jitter();
  return {
    ...vehicle,
    latitude: nextLat,
    longitude: nextLng,
    heading: bearing(vehicle, { latitude: nextLat, longitude: nextLng }),
  };
}

export function stepAllVehicles(vehicles) {
  return vehicles.map(stepVehicle);
}

// Simulate one passenger boarding: pick a non-full vehicle and decrement its seats.
export function decrementOneSeat(vehicles) {
  const candidates = vehicles
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.availableSeats > 0);
  if (candidates.length === 0) return vehicles;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return vehicles.map((v, i) =>
    i === pick.i ? { ...v, availableSeats: v.availableSeats - 1 } : v,
  );
}

export const MAP_INITIAL_REGION = {
  latitude: 6.673,
  longitude: -1.565,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Minimal dark map style (Google Maps only — ignored by Apple Maps).
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1E1E1E' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#E0E0E0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1E1E1E' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1E1E1E' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1E1E1E' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#1E1E1E' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3a3a' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f0f0f' }] },
];
