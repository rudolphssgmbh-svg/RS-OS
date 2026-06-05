CREATE TABLE IF NOT EXISTS runtime_verifications (
    verification_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    hypothesis_id UUID REFERENCES runtime_hypotheses(hypothesis_id),

    verification_method TEXT NOT NULL,

    verification_notes TEXT,

    status TEXT DEFAULT 'pending',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS runtime_verification_results (
    result_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    verification_id UUID REFERENCES runtime_verifications(verification_id),

    result_status TEXT NOT NULL,

    confidence NUMERIC(5,2),

    accepted_as_fact BOOLEAN DEFAULT FALSE,

    result_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_verifications_tenant
ON runtime_verifications(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_verifications_hypothesis
ON runtime_verifications(hypothesis_id);

CREATE INDEX IF NOT EXISTS idx_runtime_verification_results_tenant
ON runtime_verification_results(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_verification_results_verification
ON runtime_verification_results(verification_id);
