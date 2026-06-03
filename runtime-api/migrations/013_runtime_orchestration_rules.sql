CREATE TABLE IF NOT EXISTS runtime_orchestration_rules (
  rule_id text PRIMARY KEY,

  tenant_id text NOT NULL,

  rule_name text NOT NULL,

  source_event_type text NOT NULL,

  orchestration_type text NOT NULL,

  enabled boolean NOT NULL DEFAULT true,

  payload_template jsonb DEFAULT '{}'::jsonb,

  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_orchestration_rules_event
ON runtime_orchestration_rules (
  tenant_id,
  source_event_type,
  enabled
);
