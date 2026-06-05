CREATE TABLE IF NOT EXISTS runtime_workflow_instances (
  workflow_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  object_id text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  job_count integer DEFAULT 0,
  completed_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  compensated_count integer DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_tenant
ON runtime_workflow_instances(tenant_id);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_status
ON runtime_workflow_instances(status);
