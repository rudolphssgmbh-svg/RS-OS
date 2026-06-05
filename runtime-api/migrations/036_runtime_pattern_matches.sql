CREATE TABLE IF NOT EXISTS runtime_pattern_matches (
    match_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    pattern_id UUID
        REFERENCES runtime_patterns(pattern_id),

    related_object_type TEXT,

    related_object_id TEXT,

    heuristic_trigger_id UUID
        REFERENCES runtime_heuristic_triggers(trigger_id),

    match_reason TEXT,

    match_confidence NUMERIC(5,2),

    status TEXT DEFAULT 'open',

    matched_at TIMESTAMPTZ DEFAULT NOW(),
    matched_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_pattern_matches_tenant
ON runtime_pattern_matches(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_pattern_matches_pattern
ON runtime_pattern_matches(pattern_id);

CREATE INDEX IF NOT EXISTS idx_runtime_pattern_matches_status
ON runtime_pattern_matches(status);
