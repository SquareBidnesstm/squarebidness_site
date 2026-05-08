# Square Bidness Data Ledger

Square Bidness keeps live app data in the system each product already uses, then writes independent audit copies to Supabase.

## Current Ledger

- Database: Supabase
- Table: `event_ledger`
- First system wired: Delish timeclock

## Export Route

Protected route:

```text
/api/ledger/export/
```

Use the `x-ledger-token` header when possible. The route accepts `SQUARE_BIDNESS_LEDGER_TOKEN`, `LEDGER_EXPORT_TOKEN`, or `DELISH_OPERATOR_TOKEN` as a fallback.

## Test Write Route

Protected route:

```text
/api/ledger/test-write/
```

This writes one harmless `ledger_test` event to Supabase. Use it to confirm environment variables, Supabase access, and the `event_ledger` table before testing employee data.

Browser test:

```text
/api/ledger/test-write/?token=YOUR_LEDGER_TOKEN
```

Examples:

```text
/api/ledger/export/?brand=delish&system=timeclock&format=jsonl
/api/ledger/export/?brand=delish&system=timeclock&format=csv
/api/ledger/export/?brand=delish&system=timeclock&date=2026-05-07&format=csv
```

Supported query params:

- `brand`
- `system`
- `event_type`
- `date`
- `start`
- `end`
- `limit`
- `format`: `jsonl`, `json`, or `csv`

## Backup Layers

1. Live app data remains in the operating system, such as Redis.
2. Supabase `event_ledger` stores the Square Bidness audit copy.
3. Export route produces files for long-term storage.
4. External encrypted drive or cloud folder stores cold backups.

## Recommended File Storage

```text
SquareBidness/DataBackups/SystemLedgers/
SquareBidness/DataBackups/Delish/
SquareBidness/DataBackups/ChocolateCity/
```

Use JSONL for raw ledger backup and CSV for human review.
