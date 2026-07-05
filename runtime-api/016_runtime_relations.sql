CREATE TABLE IF NOT EXISTS runtime_relations (
  relation_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  target_object_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_relations_tenant_id
  ON runtime_relations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_relations_source_object_id
  ON runtime_relations (source_object_id);

CREATE INDEX IF NOT EXISTS idx_runtime_relations_target_object_id
  ON runtime_relations (target_object_id);

CREATE INDEX IF NOT EXISTS idx_runtime_relations_type
  ON runtime_relations (relation_type);
