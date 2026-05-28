CREATE TABLE IF NOT EXISTS runtime_workflow_dependencies (
  id bigserial PRIMARY KEY,
  tenant_id text NOT NULL,
  workflow_id text NOT NULL,
  object_id text NOT NULL,
  from_execution_type text NOT NULL,
  to_execution_type text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_deps_workflow
ON runtime_workflow_dependencies(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflow_deps_to
ON runtime_workflow_dependencies(workflow_id, to_execution_type);

CREATE INDEX IF NOT EXISTS idx_workflow_deps_from
ON runtime_workflow_dependencies(workflow_id, from_execution_type);
