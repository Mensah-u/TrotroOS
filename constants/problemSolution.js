/**
 * Problem → solution copy. Every string should answer:
 * "What pain does this remove?" not "What feature is this?"
 */
export const PASSENGER = {
  /** Core problem (WhatsApp groups, guessing, missed trotros) */
  problem:
    'Stop guessing which trotro goes your way — see live vehicles and hold a seat in seconds.',

  /** 5-second value on Find Ride (no route yet) */
  heroTitle: 'Where are you going?',
  heroSteps: ['Pick route', 'See live map', 'Reserve seat'],

  /** While debouncing / loading map */
  loadingLive: 'Finding live trotros on your route…',

  /** Route set, waiting for results */
  routeScanning: (count) =>
    count > 0
      ? `${count} live trotro${count === 1 ? '' : 's'} on this route — tap one to reserve`
      : 'No trotros live yet — join the queue so mates see you waiting',

  /** Header subtitles by state */
  subtitleIdle: 'Live trotros · Kumasi',
  subtitleActive: (from, to) => `${from} → ${to}`,

  /** Reserve flow */
  reserveCta: 'Reserve seat',
  reserveSheetCta: 'Reserve this ride',
};

export const WELCOME = {
  problemLine: 'No more shouting at the roadside or scrolling WhatsApp for a ride.',
  passengerTitle: 'Find & reserve a seat',
  passengerSubtitle: 'See live trotros on your route. Hold a seat for 10 minutes. Track your ride.',
  mateTitle: 'Fill seats on your route',
  mateSubtitle: 'Start your trip once. Passengers waiting on your route see you on the map.',
};
