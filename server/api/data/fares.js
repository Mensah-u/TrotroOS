/**
 * Server-authoritative fare table. Mirrors `constants/routes.js` but is kept
 * separate so the client cannot tamper with it. Update both when fares change
 * (or, even better, swap this for a Supabase view backed by a `fares` table).
 */

module.exports = {
  defaultFareGhs: 6,
  routes: [
    { id: 'tech-junction',       origin: 'KNUST',         destination: 'Tech Junction',  fareGhs: 3 },
    { id: 'tech-ayeduase',       origin: 'KNUST',         destination: 'Ayeduase',       fareGhs: 2 },
    { id: 'tech-bomso',          origin: 'KNUST',         destination: 'Bomso',          fareGhs: 3 },
    { id: 'tech-ksicity',        origin: 'KNUST',         destination: 'Kumasi City',    fareGhs: 6 },
    { id: 'city-suame',          origin: 'Kumasi City',   destination: 'Suame',          fareGhs: 5 },
    { id: 'city-tafo',           origin: 'Kumasi City',   destination: 'Tafo',           fareGhs: 5 },
    { id: 'city-bantama',        origin: 'Kumasi City',   destination: 'Bantama',        fareGhs: 4 },
    { id: 'city-asafo',          origin: 'Kumasi City',   destination: 'Asafo',          fareGhs: 4 },
    { id: 'city-adum',           origin: 'Kumasi City',   destination: 'Adum',           fareGhs: 3 },
    { id: 'city-airport',        origin: 'Kumasi City',   destination: 'Airport',        fareGhs: 8 },
  ],
};
