CREATE TABLE IF NOT EXISTS runtime_fact_confidence (
    confidence_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    fact_id UUID
        REFERENCES runtime_facts(fact_id),

    confidence_score NUMERIC(5,2),

    trust_level TEXT,

    calculation_details JSONB,

    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    calculated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_fact_confidence_tenant
ON runtime_fact_confidence(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_fact_confidence_fact
ON runtime_fact_confidence(fact_id);

CREATE INDEX IF NOT EXISTS idx_runtime_fact_confidence_trust_level
ON runtime_fact_confidence(trust_level);
