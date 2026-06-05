CREATE TABLE IF NOT EXISTS runtime_cross_loop_validations (
    validation_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    fact_id UUID
        REFERENCES runtime_facts(fact_id),

    heuristic_id UUID
        REFERENCES runtime_heuristics(heuristic_id),

    pattern_id UUID
        REFERENCES runtime_patterns(pattern_id),

    trigger_id UUID
        REFERENCES runtime_heuristic_triggers(trigger_id),

    match_id UUID
        REFERENCES runtime_pattern_matches(match_id),

    verification_confidence NUMERIC(5,2),

    source_quality NUMERIC(5,2),

    heuristic_reliability NUMERIC(5,2),

    pattern_confidence NUMERIC(5,2),

    open_unknowns INTEGER DEFAULT 0,

    open_conflicts INTEGER DEFAULT 0,

    cross_loop_trust NUMERIC(5,2),

    trust_level TEXT,

    governance_recommendation TEXT,

    human_approval_required BOOLEAN DEFAULT TRUE,

    calculation_details JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_cross_loop_validations_tenant
ON runtime_cross_loop_validations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_cross_loop_validations_fact
ON runtime_cross_loop_validations(fact_id);

CREATE INDEX IF NOT EXISTS idx_runtime_cross_loop_validations_trust
ON runtime_cross_loop_validations(trust_level);
