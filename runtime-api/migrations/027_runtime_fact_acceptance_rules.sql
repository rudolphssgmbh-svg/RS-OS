CREATE TABLE IF NOT EXISTS runtime_fact_acceptance_rules (
    rule_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    rule_name TEXT NOT NULL,

    minimum_verification_confidence NUMERIC(5,2),

    minimum_source_quality NUMERIC(5,2),

    minimum_evidence_count INTEGER,

    maximum_open_unknowns INTEGER,

    maximum_open_conflicts INTEGER,

    enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_fact_acceptance_rules_tenant
ON runtime_fact_acceptance_rules(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_fact_acceptance_rules_enabled
ON runtime_fact_acceptance_rules(enabled);
