CREATE TABLE IF NOT EXISTS runtime_sources (
    source_id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    title TEXT,
    description TEXT,
    source_url TEXT,
    jurisdiction TEXT,
    source_owner TEXT,
    trust_level INTEGER,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS runtime_evidence (
    evidence_id UUID PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    source_id UUID REFERENCES runtime_sources(source_id),
    object_id TEXT,
    event_id UUID,
    evidence_type TEXT NOT NULL,
    title TEXT,
    evidence_text TEXT,
    evidence_hash TEXT,
    confidence NUMERIC(5,2),
    evidence_status TEXT DEFAULT 'captured',
    observed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_sources_tenant_id
ON runtime_sources(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_evidence_tenant_id
ON runtime_evidence(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_evidence_source_id
ON runtime_evidence(source_id);

CREATE INDEX IF NOT EXISTS idx_runtime_evidence_object_id
ON runtime_evidence(object_id);
