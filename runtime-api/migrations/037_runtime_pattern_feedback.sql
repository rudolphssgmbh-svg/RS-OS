CREATE TABLE IF NOT EXISTS runtime_pattern_feedback (
    feedback_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    pattern_id UUID
        REFERENCES runtime_patterns(pattern_id),

    match_id UUID
        REFERENCES runtime_pattern_matches(match_id),

    lesson_id UUID
        REFERENCES runtime_lessons_learned(lesson_id),

    outcome_correct BOOLEAN,

    confidence_before NUMERIC(5,2),

    confidence_after NUMERIC(5,2),

    feedback_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_pattern_feedback_tenant
ON runtime_pattern_feedback(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_pattern_feedback_pattern
ON runtime_pattern_feedback(pattern_id);

CREATE INDEX IF NOT EXISTS idx_runtime_pattern_feedback_match
ON runtime_pattern_feedback(match_id);
