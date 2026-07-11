CREATE TABLE IF NOT EXISTS runtime_risks (
  risk_id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  risk_category TEXT NOT NULL DEFAULT 'general',
  risk_state TEXT NOT NULL DEFAULT 'concrete',
  probability INTEGER NOT NULL DEFAULT 1,
  damage INTEGER NOT NULL DEFAULT 1,
  risk_score INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runtime_risks_tenant_object_created
ON runtime_risks(tenant_id, object_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_runtime_risks_tenant_state
ON runtime_risks(tenant_id, risk_state);
