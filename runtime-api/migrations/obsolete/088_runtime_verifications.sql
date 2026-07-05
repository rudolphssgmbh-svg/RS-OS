CREATE TABLE IF NOT EXISTS runtime_verifications (
  verification_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  verification_result TEXT NOT NULL,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_verifications_tenant_id
ON runtime_verifications (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_verifications_target
ON runtime_verifications (target_type, target_id);
