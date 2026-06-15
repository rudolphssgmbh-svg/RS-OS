CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS runtime_verification_cycles (
  verification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id text NOT NULL,

  outcome_id uuid NULL,
  measurement_id uuid NULL,

  hypothesis_id uuid NULL,
  assumption_id uuid NULL,
  fact_id uuid NULL,

  verification_type text NOT NULL,
  verification_status text DEFAULT 'pending',

  expected_value text NULL,
  observed_value text NULL,

  verification_result text NULL,

  confidence_before numeric NULL,
  confidence_after numeric NULL,

  verified_at timestamptz NULL,

  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_runtime_verification_cycles_tenant
ON runtime_verification_cycles(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_verification_cycles_outcome
ON runtime_verification_cycles(outcome_id);

CREATE INDEX IF NOT EXISTS idx_runtime_verification_cycles_measurement
ON runtime_verification_cycles(measurement_id);
