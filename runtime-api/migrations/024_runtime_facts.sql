CREATE TABLE IF NOT EXISTS runtime_facts (
    fact_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    verification_result_id UUID
        REFERENCES runtime_verification_results(result_id),

    fact_text TEXT NOT NULL,

    confidence NUMERIC(5,2),

    fact_status TEXT DEFAULT 'accepted',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS runtime_fact_sources (
    fact_source_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    fact_id UUID
        REFERENCES runtime_facts(fact_id),

    evidence_id UUID
        REFERENCES runtime_evidence(evidence_id),

    source_weight NUMERIC(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_facts_tenant
ON runtime_facts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_facts_verification
ON runtime_facts(verification_result_id);

CREATE INDEX IF NOT EXISTS idx_runtime_fact_sources_fact
ON runtime_fact_sources(fact_id);

CREATE INDEX IF NOT EXISTS idx_runtime_fact_sources_evidence
ON runtime_fact_sources(evidence_id);
