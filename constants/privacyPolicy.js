/** In-app privacy policy — keep in sync with docs/PRIVACY_POLICY.md */

export const PRIVACY_POLICY_UPDATED = '28 May 2026';

export const PRIVACY_POLICY_SECTIONS = [
  {
    title: 'Overview',
    body:
      'TrotroOS connects passengers with trotro mates in Kumasi. We collect only the data needed to show live vehicles, hold seat reservations, and improve reliability. We do not sell your data or show ads.',
  },
  {
    title: 'Data we collect',
    body:
      '• Location (foreground only): GPS while the app is open so passengers see nearby mates and mates see waiting riders.\n' +
      '• Device ID: a random ID stored on your phone for passengers who do not sign in.\n' +
      '• Profile: optional display name and phone; mates also provide vehicle details for sign-up.\n' +
      '• Trips & reservations: route, seats, timestamps for booking and support.\n' +
      '• Ratings: optional star ratings after a trip.\n' +
      '• Diagnostics: crash reports if error monitoring is enabled in production builds.',
  },
  {
    title: 'Payments',
    body:
      'Fares are paid directly to your mate in cash or mobile money when you board. In-app card/mobile-money checkout is not enabled in this version.',
  },
  {
    title: 'How long we keep data',
    body:
      'Live location pings are removed when you leave the queue or cancel a reservation. Reservation records may be kept up to 12 months for disputes. Local app cache can be cleared anytime in Profile → Data & privacy.',
  },
  {
    title: 'Who we share with',
    body:
      '• Supabase — database and authentication (hosted in EU region).\n' +
      '• Other riders/mates — only what is needed for a trip (route, live map position when sharing is on).\n' +
      '• Law enforcement — only when required by valid legal process.',
  },
  {
    title: 'Your controls',
    body:
      '• Profile → Privacy — toggle location sharing.\n' +
      '• Profile → Data & privacy — export local data, clear cache, request deletion.\n' +
      '• Android Settings → Apps → TrotroOS → Permissions — revoke location anytime.',
  },
  {
    title: 'Children',
    body: 'The service is not directed to children under 13.',
  },
  {
    title: 'Contact',
    body: 'TrotroOS · Kumasi, Ghana · support@trotroos.com',
  },
];
