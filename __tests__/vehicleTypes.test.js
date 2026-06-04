import {
  clampMatePassengerSeats,
  getMatePassengerSeatLimits,
  getSeatLimitsForVehicleType,
  normalizeVehicleType,
  vehicleMatchesFilter,
} from '../constants/vehicleTypes';

describe('vehicleTypes', () => {
  test('normalizeVehicleType resolves labels and ids', () => {
    expect(normalizeVehicleType('trotro')).toBe('Trotro');
    expect(normalizeVehicleType('Taxi')).toBe('Taxi');
    expect(normalizeVehicleType('')).toBe('Trotro');
  });

  test('getSeatLimitsForVehicleType returns catalog min/max', () => {
    const taxi = getSeatLimitsForVehicleType('Taxi');
    expect(taxi.min).toBe(1);
    expect(taxi.max).toBe(4);
    expect(taxi.default).toBe(4);
  });

  test('getMatePassengerSeatLimits allows mate-defined capacity up to 99', () => {
    const limits = getMatePassengerSeatLimits('Trotro');
    expect(limits.min).toBe(1);
    expect(limits.max).toBe(99);
    expect(limits.default).toBe(14);
  });

  test('clampMatePassengerSeats enforces mate limits', () => {
    expect(clampMatePassengerSeats(0, 'Trotro')).toBe(14);
    expect(clampMatePassengerSeats(50, 'Taxi')).toBe(50);
    expect(clampMatePassengerSeats(200, 'Trotro')).toBe(99);
  });

  test('vehicleMatchesFilter compares normalized labels', () => {
    expect(vehicleMatchesFilter('trotro', 'Trotro')).toBe(true);
    expect(vehicleMatchesFilter('Taxi', 'Trotro')).toBe(false);
    expect(vehicleMatchesFilter('Bus', null)).toBe(true);
  });
});
