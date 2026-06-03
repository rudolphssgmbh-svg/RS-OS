CREATE TABLE IF NOT EXISTS runtime_orchestrations (
  orchestration_id text PRIMARY KEY,

  tenant_id text NOT NULL,

  source_event_type text NOT NULL,
  source_object_id text,

  orchestration_type text NOT NULL,

  status text NOT NULL DEFAULT 'pending',

  payload jsonb DEFAULT '{}'::jsonb,

  created_by text,
  created_at timestamptz DEFAULT now(),

  approved_by text,
  approved_at timestamptz,

  executed_by text,
  executed_at timestamptz,

  completed_by text,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_runtime_orchestrations_tenant_status
ON runtime_orchestrations (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_runtime_orchestrations_source
ON runtime_orchestrations (tenant_id, source_event_type, source_object_id);

CREATE INDEX IF NOT EXISTS idx_runtime_orchestrations_type
ON runtime_orchestrations (tenant_id, orchestration_type);
