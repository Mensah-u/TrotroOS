/** In-app events for mate → passenger seat invites (works across tabs). */

const inviteListeners = new Set();
const acceptedListeners = new Set();

export function subscribeMateRideInvites(listener) {
  inviteListeners.add(listener);
  return () => inviteListeners.delete(listener);
}

export function emitMateRideInvite(request) {
  inviteListeners.forEach((fn) => {
    try {
      fn(request);
    } catch (e) {
      console.warn('[rideRequestBus] invite listener failed:', e?.message ?? e);
    }
  });
}

export function subscribeMateRideAccepted(listener) {
  acceptedListeners.add(listener);
  return () => acceptedListeners.delete(listener);
}

export function emitMateRideAccepted(payload) {
  acceptedListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.warn('[rideRequestBus] accepted listener failed:', e?.message ?? e);
    }
  });
}
