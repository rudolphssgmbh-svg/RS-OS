ALTER TABLE runtime_events
ADD COLUMN IF NOT EXISTS event_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_runtime_events_event_payload_gin
ON runtime_events USING GIN (event_payload);
