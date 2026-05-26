# Square Bidness Events

## Production Bot Protection

Cloudflare Turnstile is wired into public customer/organizer flows:

- Organizer signup
- Paid checkout
- Free RSVP
- Waitlist
- Ticket lookup
- Ticket transfer

Set these Vercel environment variables to activate enforcement:

```txt
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
TURNSTILE_REQUIRED=true
```

If `TURNSTILE_REQUIRED` is not `true`, missing Turnstile keys fail open so local development and preview builds keep working.

