CREATE TABLE IF NOT EXISTS runtime_sources (
  source_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_reference TEXT,
  trust_level INTEGER DEFAULT 3,
  status TEXT DEFAULT 'active',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_sources_tenant_id
ON runtime_sources (tenant_id);
