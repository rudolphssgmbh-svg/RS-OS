CREATE TABLE IF NOT EXISTS runtime_source_quality (
    source_quality_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    source_id UUID
        REFERENCES runtime_sources(source_id),

    quality_dimension TEXT NOT NULL,

    rating NUMERIC(5,2),

    assessment_notes TEXT,

    assessed_at TIMESTAMPTZ DEFAULT NOW(),
    assessed_by TEXT
);

CREATE TABLE IF NOT EXISTS runtime_source_conflicts (
    conflict_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    source_id_a UUID
        REFERENCES runtime_sources(source_id),

    source_id_b UUID
        REFERENCES runtime_sources(source_id),

    conflict_type TEXT NOT NULL,

    description TEXT,

    status TEXT DEFAULT 'open',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_source_quality_tenant
ON runtime_source_quality(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_source_quality_source
ON runtime_source_quality(source_id);

CREATE INDEX IF NOT EXISTS idx_runtime_source_conflicts_tenant
ON runtime_source_conflicts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_source_conflicts_status
ON runtime_source_conflicts(status);
