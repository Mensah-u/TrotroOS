/**
 * Fare resolver.
 *
 * Asks the backend for the authoritative fare; falls back to the bundled
 * route table if the backend is unreachable. The bundled value is only ever
 * a hint — when payment is initialised the server re-checks it.
 */

import { getRouteFare, findRouteIdByLabel } from '@/constants/routes';
import { apiAvailable, apiFetch } from '@/services/apiClient';

function localQuote({ routeId, origin, destination, routeLabel }) {
  if (routeId) {
    const fareGhs = getRouteFare(routeId);
    if (fareGhs != null) return { fareGhs, source: 'local-route-id', routeId };
  }
  if (routeLabel) {
    const id = findRouteIdByLabel(routeLabel);
    if (id) {
      const fareGhs = getRouteFare(id);
      if (fareGhs != null) return { fareGhs, source: 'local-route-label', routeId: id };
    }
  }
  // Last resort — same flat fallback as the server.
  return { fareGhs: 6, source: 'local-default', routeId: null };
}

export async function quoteFare({ routeId, origin, destination, routeLabel } = {}) {
  if (!apiAvailable()) {
    return { ...localQuote({ routeId, origin, destination, routeLabel }), currency: 'GHS', authoritative: false };
  }
  const { ok, data } = await apiFetch('/fares/quote', {
    method: 'POST',
    body: { routeId, origin, destination },
  });
  if (!ok || !data) {
    return { ...localQuote({ routeId, origin, destination, routeLabel }), currency: 'GHS', authoritative: false };
  }
  return { ...data, authoritative: true };
}
