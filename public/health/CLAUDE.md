# Square Bidness Health — Project Context

## What This Is
A licensed CNA float pool staffing platform serving rural Louisiana. CNAs join a regional pool, facilities submit staffing requests, and all placements are supervised by on-staff RNs. This is a clinical staffing operation — not telehealth.

**Live at:** https://www.squarebidness.com/health/
**Code location:** `public/health/` (static HTML), `api/health/` (serverless handlers)
**Supabase project:** squarebidness-events (uwgssnrbeisdqdknpscu)

## Business Context
- Louisiana LLC, self-funded
- 2 RN nurses already on staff — this is a real operation ready to run now
- Rural Louisiana grant opportunity: Delta Regional Authority, USDA Rural Development, HRSA Rural Health Grants
- Fast build expected

## Service Area (3 Parishes)
- **Rapides Parish** — Alexandria / Pineville (HQ2, Central Louisiana)
- **Tangipahoa Parish** — Hammond / Amite / Ponchatoula (HQ1, Southeast Louisiana)
- **Washington Parish** — Bogalusa / Franklinton / Mt. Herman (North Louisiana)

## 3-Node Infrastructure
| Node | Location | Status |
|---|---|---|
| HQ1 | Hammond, Tangipahoa Parish | OPERATIONAL |
| HQ2 | Pineville, Rapides Parish | IN BUILD — solar + battery + generator |
| Archive | Mt. Herman, Washington Parish | STAGED — cold archive / disaster recovery |

Hardened infrastructure = stays up during hurricanes. Key competitive differentiator.

## What's Built
| File | Purpose |
|---|---|
| `public/health/index.html` | Main landing page (664 lines) |
| `public/health/join/index.html` | CNA application form |
| `public/health/partner/index.html` | Facility staffing inquiry form |
| `public/health/supabase/schema.sql` | Supabase table definitions |
| `api/health/cna-application.js` | POST handler → health_cna_applications |
| `api/health/facility-inquiry.js` | POST handler → health_facility_inquiries |

## Supabase Tables
- `health_cna_applications` — fields: full_name, phone, email, city, cert_number, cert_expiry, experience, availability, travel_range, preferred_shift, facility_types, notes, sms_ok, status
- `health_facility_inquiries` — fields: facility_name, contact_name, title, phone, email, facility_type, parish, shifts_needed, urgency, notes, status

Both handlers use SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars. CORS locked to https://www.squarebidness.com.

## Three Audience Lanes
1. **CNAs** — join float pool, consistent shifts, RN supervision
2. **Facilities** — nursing homes, home health agencies, rural clinics needing verified CNAs
3. **Partners** — rural health networks, funders, infrastructure collaborators

## Branding
- Gold accent: `#b79c6e` / `#8f7a55`
- Background: `#f6f4ef`
- Dark: `#111111`
- Icons: `assets/health-192.png`, `health-180.png`, `health-48.png`, `health-32.png`, `health-16.png`

## Known TODOs
- Twilio SMS notification on new CNA application / facility inquiry (both handlers have TODO comment)
- `/health/about/` page linked in nav — may not exist yet
- Confirm Supabase schema.sql was run against the squarebidness-events project
- Check if Rapides, Tangipahoa, Washington Parish qualify as HPSA / MUA — unlocks federal grant programs

## Grant Strategy
Target: Delta Regional Authority, USDA Rural Development Community Facilities, HRSA Rural Health, Louisiana Dept of Health rural initiatives, CDFI Fund.
Pitch: working platform + licensed RN staff + rural parishes served = proven capacity, not a concept.
