CREATE TABLE IF NOT EXISTS runtime_governance_outcomes (
    outcome_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    governance_check_id UUID
        REFERENCES runtime_governance_checks(governance_check_id),

    fact_id UUID
        REFERENCES runtime_facts(fact_id),

    outcome_status TEXT NOT NULL,

    outcome_correct BOOLEAN,

    outcome_notes TEXT,

    outcome_date TIMESTAMPTZ DEFAULT NOW(),

    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    recorded_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_outcomes_tenant
ON runtime_governance_outcomes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_outcomes_fact
ON runtime_governance_outcomes(fact_id);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_outcomes_status
ON runtime_governance_outcomes(outcome_status);
