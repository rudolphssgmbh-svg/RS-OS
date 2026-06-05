CREATE TABLE IF NOT EXISTS runtime_heuristics (
    heuristic_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    heuristic_name TEXT NOT NULL,

    heuristic_category TEXT,

    description TEXT,

    risk_level TEXT,

    reliability_score NUMERIC(5,2),

    usage_count INTEGER DEFAULT 0,

    success_count INTEGER DEFAULT 0,

    failure_count INTEGER DEFAULT 0,

    enabled BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_heuristics_tenant
ON runtime_heuristics(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_heuristics_category
ON runtime_heuristics(heuristic_category);

CREATE INDEX IF NOT EXISTS idx_runtime_heuristics_enabled
ON runtime_heuristics(enabled);
