CREATE TABLE IF NOT EXISTS runtime_heuristic_feedback (
    feedback_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    heuristic_id UUID
        REFERENCES runtime_heuristics(heuristic_id),

    trigger_id UUID
        REFERENCES runtime_heuristic_triggers(trigger_id),

    lesson_id UUID
        REFERENCES runtime_lessons_learned(lesson_id),

    outcome_correct BOOLEAN,

    reliability_before NUMERIC(5,2),

    reliability_after NUMERIC(5,2),

    feedback_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_heuristic_feedback_tenant
ON runtime_heuristic_feedback(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_heuristic_feedback_heuristic
ON runtime_heuristic_feedback(heuristic_id);

CREATE INDEX IF NOT EXISTS idx_runtime_heuristic_feedback_trigger
ON runtime_heuristic_feedback(trigger_id);
