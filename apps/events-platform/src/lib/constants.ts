export const PLATFORM_FEE_BASE_CENTS = 150;  // $1.50 flat per paid ticket
export const PLATFORM_FEE_PCT = 0.02;         // + 2% of ticket price
export const CANCELLATION_FEE_PERCENT = 0.08; // 8% cancellation/processing fee
export const PLATFORM_NAME = "Square Bidness Events";
export const PLATFORM_URL = "https://events.squarebidness.com";
export const SUPPORT_EMAIL = "events@squarebidness.com";

export const EVENT_CATEGORIES = [
  { value: "comedy", label: "Comedy Show" },
  { value: "trail_ride", label: "Trail Ride" },
  { value: "concert", label: "Concert" },
  { value: "meetup", label: "Meetup" },
  { value: "pop_up", label: "Pop-Up" },
  { value: "community", label: "Community Event" },
  { value: "sports", label: "Sports" },
  { value: "other", label: "Other" },
] as const;

export const TIMEZONES = [
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
] as const;
