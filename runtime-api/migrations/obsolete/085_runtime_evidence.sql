CREATE TABLE IF NOT EXISTS runtime_evidence (
  evidence_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_id TEXT,
  target_type TEXT,
  target_id TEXT,
  evidence_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  confidence NUMERIC(5,2),
  status TEXT DEFAULT 'collected',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_evidence_tenant_id
ON runtime_evidence (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_evidence_target
ON runtime_evidence (target_type, target_id);
