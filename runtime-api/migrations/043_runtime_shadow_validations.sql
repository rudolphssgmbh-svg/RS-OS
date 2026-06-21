CREATE TABLE IF NOT EXISTS runtime_shadow_validations (
    shadow_validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,
    ingress_id UUID NOT NULL REFERENCES runtime_ingress_events(ingress_id),

    object_id UUID,
    object_type TEXT,

    proposed_action TEXT NOT NULL,

    current_state JSONB,
    proposed_state JSONB NOT NULL,

    validation_scope TEXT NOT NULL,
    validation_engine TEXT NOT NULL,

    pattern_result JSONB,
    heuristic_result JSONB,
    governance_result JSONB,
    cross_loop_result JSONB,
    timeline_result JSONB,

    validation_status TEXT NOT NULL DEFAULT 'pending',
    validation_decision TEXT,

    risk_score NUMERIC(5,2),
    confidence_score NUMERIC(5,2),

    findings JSONB,
    required_actions JSONB,

    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_shadow_validations_tenant
ON runtime_shadow_validations (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_shadow_validations_ingress
ON runtime_shadow_validations (ingress_id);

CREATE INDEX IF NOT EXISTS idx_runtime_shadow_validations_status
ON runtime_shadow_validations (validation_status);

CREATE INDEX IF NOT EXISTS idx_runtime_shadow_validations_decision
ON runtime_shadow_validations (validation_decision);
