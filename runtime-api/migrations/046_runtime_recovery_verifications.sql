CREATE TABLE IF NOT EXISTS runtime_recovery_verifications (
    verification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,

    recovery_request_id UUID NOT NULL,
    savepoint_id UUID,

    verification_status TEXT NOT NULL,
    verification_result JSONB NOT NULL DEFAULT '{}'::jsonb,

    verified_by TEXT NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    closure_status TEXT NOT NULL DEFAULT 'pending',

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_recovery_verifications_tenant
ON runtime_recovery_verifications (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_recovery_verifications_request
ON runtime_recovery_verifications (recovery_request_id);

CREATE INDEX IF NOT EXISTS idx_runtime_recovery_verifications_status
ON runtime_recovery_verifications (verification_status);
