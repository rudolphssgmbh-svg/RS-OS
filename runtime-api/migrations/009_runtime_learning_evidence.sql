CREATE TABLE IF NOT EXISTS runtime_learning_evidence (
  evidence_id text PRIMARY KEY,

  tenant_id text NOT NULL,

  person_id text NOT NULL,
  competency_name text NOT NULL,

  training_plan_id text,

  gap_before integer NOT NULL,
  gap_after integer NOT NULL,

  effectiveness text NOT NULL,

  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_learning_evidence_person
ON runtime_learning_evidence (tenant_id, person_id);

CREATE INDEX IF NOT EXISTS idx_runtime_learning_evidence_competency
ON runtime_learning_evidence (tenant_id, competency_name);

CREATE INDEX IF NOT EXISTS idx_runtime_learning_evidence_training
ON runtime_learning_evidence (tenant_id, training_plan_id);
