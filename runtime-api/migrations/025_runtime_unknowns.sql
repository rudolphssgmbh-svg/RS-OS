CREATE TABLE IF NOT EXISTS runtime_unknowns (
    unknown_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    related_object_type TEXT,
    related_object_id TEXT,

    unknown_type TEXT NOT NULL,

    title TEXT NOT NULL,
    description TEXT,

    risk_level INTEGER,

    status TEXT DEFAULT 'open',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE TABLE IF NOT EXISTS runtime_unknown_dependencies (
    dependency_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    unknown_id UUID
        REFERENCES runtime_unknowns(unknown_id),

    dependency_type TEXT NOT NULL,

    dependency_reference TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_unknowns_tenant
ON runtime_unknowns(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_unknowns_status
ON runtime_unknowns(status);

CREATE INDEX IF NOT EXISTS idx_runtime_unknown_dependencies_unknown
ON runtime_unknown_dependencies(unknown_id);
