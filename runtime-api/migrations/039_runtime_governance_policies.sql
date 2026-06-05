CREATE TABLE IF NOT EXISTS runtime_governance_policies (
    policy_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    policy_name TEXT NOT NULL,

    trust_level TEXT NOT NULL,

    min_trust_score NUMERIC(5,2),

    max_trust_score NUMERIC(5,2),

    governance_decision TEXT NOT NULL,

    human_approval_required BOOLEAN DEFAULT TRUE,

    autonomous_execution_allowed BOOLEAN DEFAULT FALSE,

    enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_policies_tenant
ON runtime_governance_policies(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_policies_trust_level
ON runtime_governance_policies(trust_level);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_policies_enabled
ON runtime_governance_policies(enabled);
