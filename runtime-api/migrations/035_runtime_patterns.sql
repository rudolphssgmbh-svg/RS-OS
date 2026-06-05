CREATE TABLE IF NOT EXISTS runtime_patterns (
    pattern_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    pattern_name TEXT NOT NULL,

    pattern_category TEXT,

    description TEXT,

    occurrence_count INTEGER DEFAULT 0,

    success_count INTEGER DEFAULT 0,

    failure_count INTEGER DEFAULT 0,

    confidence_score NUMERIC(5,2),

    enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_patterns_tenant
ON runtime_patterns(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_patterns_category
ON runtime_patterns(pattern_category);

CREATE INDEX IF NOT EXISTS idx_runtime_patterns_enabled
ON runtime_patterns(enabled);
