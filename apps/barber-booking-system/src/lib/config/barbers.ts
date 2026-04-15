export type Barber = {
  id: string;
  name: string;
  displayName: string;
  role: string;
  active: boolean;
};

export const BARBERS: Barber[] = [
  {
    id: "josh",
    name: "Josh Watkins",
    displayName: "Josh Watkins",
    role: "Head Barber",
    active: true
  },
  {
    id: "jj",
    name: "Jeramiah",
    displayName: "Jeramiah (J.J.)",
    role: "Barber",
    active: true
  },
  {
    id: "jmike",
    name: "J-Mike",
    displayName: "J-Mike",
    role: "Barber",
    active: true
  }
];
