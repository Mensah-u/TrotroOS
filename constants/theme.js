/** TrotroOS design system — single source of truth for premium UI. */
export const Theme = {
  colors: {
    bg: '#050505',
    bgElevated: '#0A0A0A',
    surface: '#111111',
    surfaceUp: '#1A1A1A',
    glass: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.14)',
    text: '#FAFAFA',
    textSub: '#A1A1AA',
    textMuted: '#52525B',
    mate: '#F97316',
    mateSoft: 'rgba(249,115,22,0.14)',
    mateGlow: 'rgba(249,115,22,0.45)',
    passenger: '#3B82F6',
    passengerSoft: 'rgba(59,130,246,0.14)',
    passengerGlow: 'rgba(59,130,246,0.45)',
    success: '#22C55E',
    successSoft: 'rgba(34,197,94,0.12)',
    danger: '#EF4444',
    gold: '#FBBF24',
    white: '#FFFFFF',
  },

  gradients: {
    screen: ['#050505', '#0C0C0C', '#101010'],
    welcome: ['#0A0705', '#0C0C0C', '#050508'],
    mateHero: ['rgba(249,115,22,0.18)', 'rgba(249,115,22,0)'],
    passengerHero: ['rgba(59,130,246,0.18)', 'rgba(59,130,246,0)'],
    mateCard: ['rgba(249,115,22,0.14)', 'rgba(249,115,22,0.03)'],
    passengerCard: ['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.03)'],
    buttonMate: ['#FB923C', '#EA580C'],
    buttonPassenger: ['#60A5FA', '#2563EB'],
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
  { elementType: 'geometry', stylers: [{ color: '#050505' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#52525B' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#050505' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#1A1A1A' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#141414' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#1F1F1F' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#030303' }] },
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

/** @deprecated Use Theme.colors — kept for gradual migration */
export const C = {
  BG: Theme.colors.bgElevated,
  SURFACE: Theme.colors.surface,
  SURFACE_UP: Theme.colors.surfaceUp,
  BORDER: Theme.colors.border,
  ACCENT: Theme.colors.mate,
  ACCENT_SOFT: Theme.colors.mateSoft,
  SUCCESS: Theme.colors.success,
  TEXT: Theme.colors.text,
  TEXT_SUB: Theme.colors.textSub,
  TEXT_MUTED: Theme.colors.textMuted,
};
