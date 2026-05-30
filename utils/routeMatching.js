/**
 * Flexible route matching for custom / typed locations.
 * Exact string match is too brittle when mates and passengers type
 * slightly different labels for the same place.
 */

function normalizeText(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—→]\s*/g, ' ')
    .replace(/[^\w\s]/g, '');
}

export function normalizeRouteLabel(origin, destination) {
  return `${normalizeText(origin)}|${normalizeText(destination)}`;
}

function tokens(s) {
  return normalizeText(s).split(' ').filter((t) => t.length > 1);
}

/** True when two place names likely refer to the same spot. */
export function placesMatch(a, b) {
  if (!a || !b) return false;
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return false;
  const shared = ta.filter((t) => tb.includes(t));
  return shared.length >= Math.min(ta.length, tb.length, 2);
}

/**
 * Does an active trip match what the passenger searched for?
 * Same direction only: origin must align with pickup, destination with where they are going.
 */
export function tripMatchesRoute(trip, origin, destination) {
  if (!origin || !destination) return false;

  const tripOrigin = trip.origin ?? trip.originStation ?? '';
  const tripDest = trip.destination ?? '';
  const tripRoute = trip.route ?? `${tripOrigin} - ${tripDest}`;

  const passengerLabel = `${origin} - ${destination}`;
  const passengerLabelAlt = `${origin} → ${destination}`;

  if (normalizeText(tripRoute) === normalizeText(passengerLabel)) return true;
  if (normalizeText(tripRoute) === normalizeText(passengerLabelAlt)) return true;

  return (
    placesMatch(tripOrigin, origin) &&
    placesMatch(tripDest, destination)
  );
}

/** Does a live driver broadcast match the passenger's chosen corridor? */
export function driverMatchesRoute(driver, origin, destination) {
  if (!origin || !destination || !driver?.route) return true;
  return routeLabelMatches(driver.route, origin, destination);
}

/** Match a preformatted route label (e.g. driver_locations.route). */
export function routeLabelMatches(routeLabel, origin, destination) {
  if (!routeLabel || !origin || !destination) return false;
  const passengerLabel = `${origin} → ${destination}`;
  const passengerLabelAlt = `${origin} - ${destination}`;
  if (normalizeText(routeLabel) === normalizeText(passengerLabel)) return true;
  if (normalizeText(routeLabel) === normalizeText(passengerLabelAlt)) return true;

  const [labelFrom, labelTo] = routeLabel.split(/\s[-–—→]\s/);
  if (labelFrom && labelTo) {
    return placesMatch(labelFrom, origin) && placesMatch(labelTo, destination);
  }
  return false;
}

/** Does a waiting passenger belong on this mate route? */
export function passengerMatchesRoute(passenger, routeLabel) {
  if (!routeLabel) return true;
  const queued = passenger.queued_route ?? passenger.route ?? '';
  if (!queued) return true; // show unlabelled waiters when mate is active

  const nRoute = normalizeText(routeLabel);
  const nQueued = normalizeText(queued);
  if (nRoute === nQueued) return true;

  const [routeFrom, routeTo] = routeLabel.split(/\s[-–—→]\s/);
  const [qFrom, qTo] = queued.split(/\s[-–—→]\s/);
  if (routeFrom && routeTo && qFrom && qTo) {
    return (
      (placesMatch(routeFrom, qFrom) && placesMatch(routeTo, qTo)) ||
      (placesMatch(routeFrom, qTo) && placesMatch(routeTo, qFrom))
    );
  }

  return placesMatch(queued, routeLabel);
}
