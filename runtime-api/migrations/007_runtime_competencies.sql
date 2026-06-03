CREATE TABLE IF NOT EXISTS runtime_competencies (
  competency_id text PRIMARY KEY,

  tenant_id text NOT NULL,
  person_id text NOT NULL,

  competency_name text NOT NULL,

  required_level integer NOT NULL,
  actual_level integer NOT NULL,
  gap integer NOT NULL,

  created_by text,
  created_at timestamptz DEFAULT now(),

  updated_by text,
  updated_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_runtime_competencies_tenant_person
ON runtime_competencies (tenant_id, person_id);

CREATE INDEX IF NOT EXISTS idx_runtime_competencies_gap
ON runtime_competencies (tenant_id, gap);
