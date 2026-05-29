import * as Linking from 'expo-linking';

import { findRouteByPlaces, formatRoute } from '@/constants/routes';

const APP_SCHEME = 'trotrops';

/** Shareable deep link for a route. */
export function buildRouteShareUrl(from, to, refCode) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (refCode) params.set('ref', refCode);
  return Linking.createURL(`ride?${params.toString()}`);
}

/** Shareable link for an active trip. */
export function buildTripShareUrl(tripId, routeLabel) {
  const params = new URLSearchParams();
  if (tripId) params.set('trip', tripId);
  if (routeLabel) params.set('route', routeLabel);
  return Linking.createURL(`trip?${params.toString()}`);
}

/** Parse trotrops:// ride/trip links from cold start or foreground. */
export function parseAppDeepLink(url) {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    const path = parsed.path ?? '';
    const q = parsed.queryParams ?? {};

    if (path.includes('ride') || q.from || q.to) {
      return {
        type: 'ride',
        from: q.from ?? null,
        to: q.to ?? null,
        ref: q.ref ?? null,
      };
    }
    if (path.includes('trip') || q.trip) {
      return {
        type: 'trip',
        tripId: q.trip ?? null,
        route: q.route ?? null,
      };
    }
    if (path.includes('auth')) {
      return { type: 'auth', url };
    }
  } catch {
    return null;
  }
  return null;
}

export function buildSmsInviteBody({ route, refCode, appUrl }) {
  const label = route ? formatRoute(route) : 'Kumasi trotro';
  const link = appUrl ?? buildRouteShareUrl(route?.origin, route?.destination, refCode);
  return `Try TrotroOS for ${label}. ${refCode ? `Code: ${refCode}. ` : ''}${link}`;
}

export function openSmsInvite(body, phone) {
  const encoded = encodeURIComponent(body);
  const uri = phone ? `sms:${phone}?body=${encoded}` : `sms:?body=${encoded}`;
  return Linking.openURL(uri);
}

export function resolveRouteFromDeepLink(payload) {
  if (!payload?.from || !payload?.to) return null;
  return findRouteByPlaces(payload.from, payload.to);
}
