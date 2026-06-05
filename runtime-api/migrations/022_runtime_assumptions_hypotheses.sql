CREATE TABLE IF NOT EXISTS runtime_assumptions (
    assumption_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    evidence_id UUID REFERENCES runtime_evidence(evidence_id),

    assumption_text TEXT NOT NULL,

    confidence NUMERIC(5,2),

    status TEXT DEFAULT 'open',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS runtime_hypotheses (
    hypothesis_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    assumption_id UUID REFERENCES runtime_assumptions(assumption_id),

    hypothesis_text TEXT NOT NULL,

    confidence NUMERIC(5,2),

    verification_status TEXT DEFAULT 'unverified',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_assumptions_tenant
ON runtime_assumptions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_assumptions_evidence
ON runtime_assumptions(evidence_id);

CREATE INDEX IF NOT EXISTS idx_runtime_hypotheses_tenant
ON runtime_hypotheses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_hypotheses_assumption
ON runtime_hypotheses(assumption_id);
