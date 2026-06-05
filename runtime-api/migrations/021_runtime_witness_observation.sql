CREATE TABLE IF NOT EXISTS runtime_witnesses (
    witness_id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,

    witness_type TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT,

    reliability_score NUMERIC(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS runtime_observations (
    observation_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    witness_id UUID REFERENCES runtime_witnesses(witness_id),

    evidence_id UUID REFERENCES runtime_evidence(evidence_id),

    observation_text TEXT NOT NULL,

    observation_time TIMESTAMPTZ,

    confidence NUMERIC(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_witnesses_tenant
ON runtime_witnesses(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_observations_tenant
ON runtime_observations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_observations_witness
ON runtime_observations(witness_id);

CREATE INDEX IF NOT EXISTS idx_runtime_observations_evidence
ON runtime_observations(evidence_id);
