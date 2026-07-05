CREATE TABLE IF NOT EXISTS runtime_unknowns (
  unknown_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  impact_level INTEGER DEFAULT 3,
  status TEXT DEFAULT 'open',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_unknowns_tenant_id
ON runtime_unknowns (tenant_id);
