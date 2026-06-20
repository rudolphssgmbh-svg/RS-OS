CREATE TABLE IF NOT EXISTS runtime_recommendation_verification_gates (
  gate_id text PRIMARY KEY,
  tenant_id text NOT NULL,
  recommendation_id text NOT NULL REFERENCES runtime_recommendations(recommendation_id) ON DELETE CASCADE,
  object_id text NOT NULL,

  gate_status text NOT NULL DEFAULT 'pending',
  gate_result text,
  gate_reason text,

  evidence_count integer NOT NULL DEFAULT 0,
  source_count integer NOT NULL DEFAULT 0,
  verification_count integer NOT NULL DEFAULT 0,
  unknown_count integer NOT NULL DEFAULT 0,
  assumption_count integer NOT NULL DEFAULT 0,
  hypothesis_count integer NOT NULL DEFAULT 0,
  risk_count integer NOT NULL DEFAULT 0,

  evidence_result text,
  source_result text,
  verification_result text,
  unknown_result text,
  assumption_result text,
  hypothesis_result text,
  risk_result text,
  governance_result text,

  evidence_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumption_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  hypothesis_ids jsonb NOT NULL DEFAULT '[]'::jsonb,

  residual_risk jsonb NOT NULL DEFAULT '{}'::jsonb,
  gate_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by text,
  created_at timestamp with time zone DEFAULT now(),
  decided_by text,
  decided_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_runtime_rec_gate_tenant
ON runtime_recommendation_verification_gates (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_rec_gate_recommendation
ON runtime_recommendation_verification_gates (recommendation_id);

CREATE INDEX IF NOT EXISTS idx_runtime_rec_gate_object
ON runtime_recommendation_verification_gates (tenant_id, object_id);

CREATE INDEX IF NOT EXISTS idx_runtime_rec_gate_status
ON runtime_recommendation_verification_gates (tenant_id, gate_status);
