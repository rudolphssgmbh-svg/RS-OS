CREATE TABLE IF NOT EXISTS runtime_training_plans (
  training_plan_id text PRIMARY KEY,

  tenant_id text NOT NULL,
  person_id text NOT NULL,
  competency_name text NOT NULL,

  recommendation_id text,

  training_type text NOT NULL,
  estimated_duration_minutes integer NOT NULL,

  status text NOT NULL DEFAULT 'planned',

  created_by text,
  created_at timestamptz DEFAULT now(),

  approved_by text,
  approved_at timestamptz,

  completed_by text,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_runtime_training_plans_tenant_person
ON runtime_training_plans (tenant_id, person_id);

CREATE INDEX IF NOT EXISTS idx_runtime_training_plans_status
ON runtime_training_plans (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_runtime_training_plans_recommendation
ON runtime_training_plans (tenant_id, recommendation_id);
