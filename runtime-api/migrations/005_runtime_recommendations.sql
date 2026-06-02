CREATE TABLE IF NOT EXISTS runtime_recommendations (
  recommendation_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  object_id text NOT NULL,
  recommendation_type text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  reason text,
  evidence jsonb DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz DEFAULT now(),
  approved_by text,
  approved_at timestamptz,
  executed_job_id text,
  executed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_runtime_recommendations_tenant_object
ON runtime_recommendations (tenant_id, object_id);

CREATE INDEX IF NOT EXISTS idx_runtime_recommendations_status
ON runtime_recommendations (tenant_id, status);
