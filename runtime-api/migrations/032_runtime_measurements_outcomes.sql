CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS runtime_outcomes (
  outcome_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  object_id text NULL,
  action_id text NULL,
  outcome_type text NOT NULL,
  outcome_title text NOT NULL,
  outcome_description text NULL,
  expected_result text NULL,
  actual_result text NULL,
  outcome_status text DEFAULT 'observed',
  observed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS runtime_measurements (
  measurement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  outcome_id uuid NULL REFERENCES runtime_outcomes(outcome_id) ON DELETE SET NULL,
  metric_name text NOT NULL,
  metric_value numeric NULL,
  metric_unit text NULL,
  target_value numeric NULL,
  variance_value numeric NULL,
  measurement_time timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_runtime_outcomes_tenant
  ON runtime_outcomes(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_outcomes_object
  ON runtime_outcomes(object_id);

CREATE INDEX IF NOT EXISTS idx_runtime_measurements_tenant
  ON runtime_measurements(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_measurements_outcome
  ON runtime_measurements(outcome_id);
