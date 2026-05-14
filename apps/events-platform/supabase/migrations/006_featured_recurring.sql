-- Featured flag for homepage spotlight
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

-- Recurring events grouping
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;
ALTER TABLE events ADD COLUMN IF NOT EXISTS recurrence_rule text; -- 'weekly' | 'biweekly' | 'monthly'

-- Index for fast featured lookup
CREATE INDEX IF NOT EXISTS idx_events_is_featured ON events (is_featured) WHERE is_featured = true;
