CREATE TABLE IF NOT EXISTS runtime_governance_decisions (
  decision_id TEXT PRIMARY KEY,
  object_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  governance_status TEXT NOT NULL,
  reason_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_count INTEGER NOT NULL DEFAULT 0,
  max_risk_score INTEGER NOT NULL DEFAULT 0,
  acute_risk_count INTEGER NOT NULL DEFAULT 0,
  open_action_count INTEGER NOT NULL DEFAULT 0,
  high_open_action_count INTEGER NOT NULL DEFAULT 0,
  graph_edge_count INTEGER NOT NULL DEFAULT 0,
  audit_event_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  decision_type TEXT DEFAULT 'governance_review'
);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_decisions_object
ON runtime_governance_decisions(object_id);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_decisions_status
ON runtime_governance_decisions(governance_status);

CREATE INDEX IF NOT EXISTS idx_runtime_governance_decisions_tenant
ON runtime_governance_decisions(tenant_id);
