# Barber Booking System

Duplicatable multi-barber booking system.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Stripe later
- Twilio later

## Current starter routes

- `/` = homepage
- `/book/` = shop booking entry
- `/book/[barberId]/` = barber-specific booking page
- `/admin/` = admin stub

## First setup

Set Cloudflare Turnstile on the Booking Vercel project before requiring verification:

```bash
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
TURNSTILE_REQUIRED=true
```

If `TURNSTILE_REQUIRED` is not `true`, missing Turnstile keys fail open so local development and preview builds keep working.

1. Create repo
2. Paste starter files
3. Run `npm install`
4. Run `npm run dev`
5. Open `http://localhost:3000`

## Next build steps

1. Add Supabase schema
2. Add booking API
3. Add live availability
4. Add admin auth
5. Add Stripe deposits
6. Add SMS reminders
