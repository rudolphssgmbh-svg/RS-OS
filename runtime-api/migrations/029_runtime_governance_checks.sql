CREATE TABLE IF NOT EXISTS runtime_governance_checks (
    governance_check_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    fact_id UUID
        REFERENCES runtime_facts(fact_id),

    confidence_id UUID
        REFERENCES runtime_fact_confidence(confidence_id),

    trust_level TEXT,

    governance_decision TEXT,

    human_approval_required BOOLEAN DEFAULT TRUE,

    decision_reason TEXT,

    checked_at TIMESTAMPTZ DEFAULT NOW(),
    checked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_checks_tenant
ON runtime_governance_checks(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_checks_fact
ON runtime_governance_checks(fact_id);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_checks_decision
ON runtime_governance_checks(governance_decision);
