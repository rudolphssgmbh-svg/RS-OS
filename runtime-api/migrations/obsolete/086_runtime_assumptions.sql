CREATE TABLE IF NOT EXISTS runtime_assumptions (
  assumption_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  confidence NUMERIC(5,2),
  status TEXT DEFAULT 'open',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_assumptions_tenant_id
ON runtime_assumptions (tenant_id);
