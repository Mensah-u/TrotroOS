/** UI strings — English + Twi (core flows). Extend as needed. */

export const STRINGS = {
  en: {
    findRide: 'Find Ride',
    imWaiting: "I'm Waiting",
    reserveSeat: 'Reserve seat',
    tripFull: 'Trip full',
    verifiedMate: 'Verified mate',
    shareTrip: 'Share trip',
    scheduleRide: 'Schedule ride',
    reportIssue: 'Report issue',
    bookAgain: 'Book again',
    pickupStop: 'Pickup stop',
    walkUpPassenger: 'Walk-up passenger',
    boardPassenger: 'Board',
    scheduledDemand: 'Scheduled demand',
    pushEnabled: 'Push notifications enabled',
    offlineCached: 'Showing cached routes',
    corridorBanner: 'Live on Tech Junction ↔ KNUST corridor',
    smsInvite: 'SMS invite',
  },
  tw: {
    findRide: 'Hwe Trotro',
    imWaiting: 'Metwɛn',
    reserveSeat: 'Fa baabi a wotu',
    tripFull: 'Baabi no mawie',
    verifiedMate: 'Mate a wɔahwɛ mu',
    shareTrip: 'Fa ka ho',
    scheduleRide: 'Hyɛ bere a wobɛkɔ',
    reportIssue: 'Bɔ amaneɛ',
    bookAgain: 'Fa bio',
    pickupStop: 'Fa baabi a wobɛfa',
    walkUpPassenger: 'Passenger a ɔbaa hɔ',
    boardPassenger: 'Fa no kɔ',
    scheduledDemand: 'Bere a wohyɛe',
    pushEnabled: 'Notifications ayɛ adwuma',
    offlineCached: 'Routes a wɔakora no',
    corridorBanner: 'Tech Junction ↔ KNUST wɔ hɔ',
    smsInvite: 'Fa SMS',
  },
};

export const DEFAULT_LANG = 'en';

export function translate(lang, key) {
  const code = STRINGS[lang] ? lang : DEFAULT_LANG;
  return STRINGS[code][key] ?? STRINGS.en[key] ?? key;
}
