export type TrotroRoute = {
  id: string;
  name: string;
  fare: number;
  origin: string;
  destination: string;
};

export const dummyRoutes: TrotroRoute[] = [
  {
    id: '1',
    name: 'Circle → Madina',
    fare: 5,
    origin: 'Circle',
    destination: 'Madina',
  },
  {
    id: '2',
    name: 'Kaneshie → Accra',
    fare: 4,
    origin: 'Kaneshie',
    destination: 'Accra',
  },
  {
    id: '3',
    name: 'Tema Station → Ashaiman',
    fare: 3,
    origin: 'Tema Station',
    destination: 'Ashaiman',
  },
];
