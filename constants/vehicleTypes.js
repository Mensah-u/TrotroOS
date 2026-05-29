/** Kumasi / Ghana transport modes supported in TrotroOS. */

export const DEFAULT_VEHICLE_TYPE = 'Trotro';

export const VEHICLE_TYPES = [
  { id: 'trotro', label: 'Trotro', icon: 'bus', defaultSeats: 14, minSeats: 8, maxSeats: 22 },
  { id: 'taxi', label: 'Taxi', icon: 'car', defaultSeats: 4, minSeats: 1, maxSeats: 4 },
  { id: 'bus', label: 'Bus', icon: 'bus-outline', defaultSeats: 30, minSeats: 15, maxSeats: 55 },
  { id: 'pragya', label: 'Pragya', icon: 'car-sport-outline', defaultSeats: 3, minSeats: 1, maxSeats: 4 },
  { id: 'okada', label: 'Okada', icon: 'bicycle', defaultSeats: 1, minSeats: 1, maxSeats: 2 },
  { id: 'voxy', label: 'Voxy', icon: 'car-sport', defaultSeats: 7, minSeats: 4, maxSeats: 14 },
  { id: 'sprinter', label: 'Sprinter', icon: 'bus', defaultSeats: 12, minSeats: 8, maxSeats: 18 },
  { id: 'minivan', label: 'Minivan', icon: 'car-outline', defaultSeats: 8, minSeats: 4, maxSeats: 15 },
  { id: 'metro', label: 'Metro Mass', icon: 'bus-outline', defaultSeats: 40, minSeats: 20, maxSeats: 60 },
  { id: 'stc', label: 'STC / Intercity', icon: 'bus', defaultSeats: 45, minSeats: 25, maxSeats: 55 },
  { id: 'ridehail', label: 'Ride-hail', icon: 'navigate', defaultSeats: 4, minSeats: 1, maxSeats: 4 },
  { id: 'cargo', label: 'Cargo Tricycle', icon: 'cube-outline', defaultSeats: 2, minSeats: 1, maxSeats: 3 },
  { id: 'pickup', label: 'Pickup', icon: 'car-outline', defaultSeats: 3, minSeats: 1, maxSeats: 6 },
];

const byLabel = new Map(VEHICLE_TYPES.map((v) => [v.label.toLowerCase(), v]));
const byId = new Map(VEHICLE_TYPES.map((v) => [v.id, v]));

export function normalizeVehicleType(value) {
  if (!value) return DEFAULT_VEHICLE_TYPE;
  const raw = String(value).trim();
  const lower = raw.toLowerCase();
  return byLabel.get(lower)?.label ?? byId.get(lower)?.label ?? raw;
}

export function getVehicleTypeMeta(value) {
  const label = normalizeVehicleType(value);
  const match = VEHICLE_TYPES.find((v) => v.label === label);
  if (match) return match;
  return byLabel.get(String(value ?? '').trim().toLowerCase()) ?? VEHICLE_TYPES[0];
}

export function getVehicleIcon(value) {
  return getVehicleTypeMeta(value)?.icon ?? 'bus-outline';
}

export function getSeatLimitsForVehicleType(value) {
  const meta = getVehicleTypeMeta(value);
  return {
    default: meta.defaultSeats,
    min: meta.minSeats,
    max: meta.maxSeats,
  };
}

export function vehicleMatchesFilter(vehicleType, filterLabel) {
  if (!filterLabel) return true;
  if (!vehicleType) return false;
  return normalizeVehicleType(vehicleType) === normalizeVehicleType(filterLabel);
}

/** Include a legacy/custom stored value in the picker when it is not in the catalog. */
export function getVehicleTypeOptions(currentValue) {
  const label = currentValue ? normalizeVehicleType(currentValue) : null;
  if (label && !VEHICLE_TYPES.some((v) => v.label === label)) {
    return [
      ...VEHICLE_TYPES,
      {
        id: 'custom',
        label,
        icon: 'help-circle-outline',
        defaultSeats: 10,
        minSeats: 1,
        maxSeats: 20,
      },
    ];
  }
  return VEHICLE_TYPES;
}
