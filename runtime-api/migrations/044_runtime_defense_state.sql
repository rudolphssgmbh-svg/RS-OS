CREATE TABLE IF NOT EXISTS runtime_defense_state (
    defense_state_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,

    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,

    defense_mode TEXT NOT NULL DEFAULT 'normal',
    defense_level TEXT NOT NULL DEFAULT 'standard',

    last_ingress_id UUID,
    last_quarantine_id UUID,
    last_shadow_validation_id UUID,

    open_quarantine_count INTEGER NOT NULL DEFAULT 0,
    failed_validation_count INTEGER NOT NULL DEFAULT 0,
    recent_rejection_count INTEGER NOT NULL DEFAULT 0,

    current_risk_score NUMERIC(5,2),
    current_confidence_score NUMERIC(5,2),

    active_policy_flags JSONB DEFAULT '[]'::jsonb,
    active_risk_flags JSONB DEFAULT '[]'::jsonb,

    state_reason TEXT,
    updated_by TEXT,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (tenant_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_runtime_defense_state_tenant
ON runtime_defense_state (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_defense_state_mode
ON runtime_defense_state (defense_mode);

CREATE INDEX IF NOT EXISTS idx_runtime_defense_state_scope
ON runtime_defense_state (scope_type, scope_id);
