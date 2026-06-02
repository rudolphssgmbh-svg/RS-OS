CREATE TABLE IF NOT EXISTS runtime_recommendation_rules (
  rule_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  rule_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,

  condition_definition jsonb NOT NULL,
  recommendation_definition jsonb NOT NULL,

  created_by text,
  created_at timestamptz DEFAULT now(),

  updated_by text,
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_runtime_recommendation_rules_tenant
ON runtime_recommendation_rules (tenant_id, enabled);
