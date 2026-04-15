export const SHOP = {
  id: "dapper-lounge",
  name: "Dapper Lounge",
  owner: "Josh Watkins",
  managerTitle: "Head Barber In Charge",
  city: "Orlando, FL",
  bookingBasePath: "/book",
  requireDeposit: false,
  timezone: "America/New_York",
  hours: {
    monday: "9:00 AM - 6:00 PM",
    tuesday: "9:00 AM - 6:00 PM",
    wednesday: "9:00 AM - 6:00 PM",
    thursday: "9:00 AM - 6:00 PM",
    friday: "9:00 AM - 7:00 PM",
    saturday: "8:00 AM - 4:00 PM",
    sunday: "Closed"
  }
} as const;
