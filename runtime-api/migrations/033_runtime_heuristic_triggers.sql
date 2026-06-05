CREATE TABLE IF NOT EXISTS runtime_heuristic_triggers (
    trigger_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    heuristic_id UUID
        REFERENCES runtime_heuristics(heuristic_id),

    related_object_type TEXT,

    related_object_id TEXT,

    trigger_reason TEXT,

    generated_assumption TEXT,

    generated_hypothesis TEXT,

    confidence_score NUMERIC(5,2),

    status TEXT DEFAULT 'open',

    triggered_at TIMESTAMPTZ DEFAULT NOW(),
    triggered_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_heuristic_triggers_tenant
ON runtime_heuristic_triggers(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_heuristic_triggers_heuristic
ON runtime_heuristic_triggers(heuristic_id);

CREATE INDEX IF NOT EXISTS idx_runtime_heuristic_triggers_status
ON runtime_heuristic_triggers(status);
