CREATE TABLE IF NOT EXISTS runtime_lessons_learned (
    lesson_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    outcome_id UUID
        REFERENCES runtime_governance_outcomes(outcome_id),

    fact_id UUID
        REFERENCES runtime_facts(fact_id),

    trust_level TEXT,

    governance_decision TEXT,

    outcome_correct BOOLEAN,

    lesson_type TEXT,

    lesson_summary TEXT,

    recommended_action TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_lessons_learned_tenant
ON runtime_lessons_learned(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_lessons_learned_fact
ON runtime_lessons_learned(fact_id);

CREATE INDEX IF NOT EXISTS idx_runtime_lessons_learned_type
ON runtime_lessons_learned(lesson_type);
