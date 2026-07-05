CREATE TABLE IF NOT EXISTS runtime_hypotheses (
  hypothesis_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  assumption_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  confidence NUMERIC(5,2),
  status TEXT DEFAULT 'draft',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_hypotheses_tenant_id
ON runtime_hypotheses (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_hypotheses_assumption_id
ON runtime_hypotheses (assumption_id);
