/** TrotroOS design system — single source of truth for premium UI. */
export const Brand = {
  primary: '#F36F21',
  bg: '#121212',
  card: '#1E1E1E',
  text: '#FFFFFF',
  textSoft: '#E0E0E0',
};

/** Map & role-specific colors. */
export const RoleColors = {
  mateMap: '#2196F3',
  passengerMap: '#66BB6A',
  error: '#FF5252',
  success: '#4CAF50',
};

/** Seat availability status colors. */
export const SeatStatus = {
  plenty: '#4CAF50',
  filling: '#FFC107',
  almostFull: '#F44336',
  full: '#B71C1C',
};

/**
 * Seat urgency bands:
 * - 5+ plenty (green)
 * - 2–4 filling (yellow)
 * - 1 almost full (red)
 * - 0 full (dark red)
 */
export function getSeatStatus(seats) {
  const n = Math.max(0, Number(seats) || 0);
  if (n === 0) {
    return { level: 'full', color: SeatStatus.full, label: 'Full', dot: SeatStatus.full };
  }
  if (n === 1) {
    return { level: 'almostFull', color: SeatStatus.almostFull, label: '1 seat left', dot: SeatStatus.almostFull };
  }
  if (n <= 4) {
    return { level: 'filling', color: SeatStatus.filling, label: `${n} seats`, dot: SeatStatus.filling };
  }
  return { level: 'plenty', color: SeatStatus.plenty, label: `${n} seats`, dot: SeatStatus.plenty };
}

export const Theme = {
  colors: {
    ...Brand,
    ...RoleColors,
    bgElevated: Brand.bg,
    surface: Brand.card,
    surfaceUp: Brand.card,
    glass: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.14)',
    textSub: Brand.textSoft,
    textMuted: '#A8A8A8',
    mate: Brand.primary,
    mateSoft: 'rgba(243,111,33,0.14)',
    mateGlow: 'rgba(243,111,33,0.45)',
    passenger: Brand.primary,
    passengerSoft: 'rgba(243,111,33,0.14)',
    passengerGlow: 'rgba(243,111,33,0.45)',
    successSoft: 'rgba(76,175,80,0.12)',
    errorSoft: 'rgba(255,82,82,0.12)',
    danger: RoleColors.error,
    gold: '#FFC107',
    seatPlenty: SeatStatus.plenty,
    seatFilling: SeatStatus.filling,
    seatAlmostFull: SeatStatus.almostFull,
    seatFull: SeatStatus.full,
    white: Brand.text,
  },

  gradients: {
    screen: [Brand.bg, Brand.bg, '#141414'],
    welcome: ['#141008', Brand.bg, Brand.bg],
    mateHero: ['rgba(243,111,33,0.18)', 'rgba(243,111,33,0)'],
    passengerHero: ['rgba(243,111,33,0.14)', 'rgba(243,111,33,0)'],
    mateCard: ['rgba(33,150,243,0.14)', 'rgba(33,150,243,0.03)'],
    passengerCard: ['rgba(102,187,106,0.14)', 'rgba(102,187,106,0.03)'],
    buttonMate: ['#FF8347', '#F36F21'],
    buttonPassenger: ['#FF8347', '#F36F21'],
  },

  radius: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 24,
    xxl: 28,
    pill: 999,
  },

  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
  },

  typography: {
    hero: { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
    title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
    body: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
    caption: { fontSize: 12, fontWeight: '600' },
    label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.1, textTransform: 'uppercase' },
  },
};

export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: Brand.bg }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A8A8A8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: Brand.bg }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: Brand.card }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#242424' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A0A0A' }] },
];

export function glowShadow(color, opacity = 0.4) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: opacity,
    shadowRadius: 24,
    elevation: 16,
  };
}

/** Shared screen palette — import instead of duplicating hex values. */
export const C = {
  BG: Brand.bg,
  SURFACE: Brand.card,
  SURFACE_UP: Brand.card,
  BORDER: Theme.colors.border,
  ACCENT: Brand.primary,
  ACCENT_SOFT: Theme.colors.mateSoft,
  MATE_MAP: RoleColors.mateMap,
  PASSENGER_MAP: RoleColors.passengerMap,
  SUCCESS: RoleColors.success,
  SUCCESS_SOFT: Theme.colors.successSoft,
  WARN: SeatStatus.filling,
  DANGER: RoleColors.error,
  FULL: SeatStatus.full,
  TEXT: Brand.text,
  TEXT_SUB: Brand.textSoft,
  TEXT_MUTED: Theme.colors.textMuted,
};
