export type Service = {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
  depositEligible: boolean;
};

export const SERVICES: Service[] = [
  {
    id: "haircut",
    name: "Haircut",
    durationMinutes: 45,
    price: 35,
    depositEligible: false
  },
  {
    id: "haircut-beard",
    name: "Haircut + Beard",
    durationMinutes: 60,
    price: 45,
    depositEligible: false
  },
  {
    id: "kids-cut",
    name: "Kids Cut",
    durationMinutes: 30,
    price: 25,
    depositEligible: false
  },
  {
    id: "enhancements",
    name: "Cut + Enhancements",
    durationMinutes: 60,
    price: 50,
    depositEligible: false
  },
  {
    id: "vip",
    name: "VIP Appointment",
    durationMinutes: 90,
    price: 75,
    depositEligible: true
  },
  {
    id: "consultation",
    name: "Consultation",
    durationMinutes: 30,
    price: 20,
    depositEligible: true
  }
];
