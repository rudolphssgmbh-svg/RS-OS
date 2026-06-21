CREATE TABLE IF NOT EXISTS runtime_recovery_requests (
    recovery_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,

    quarantine_id UUID,
    savepoint_id UUID,

    request_type TEXT NOT NULL,
    request_reason TEXT,

    requested_by TEXT NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    review_status TEXT NOT NULL DEFAULT 'requested',
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_comment TEXT,

    execution_status TEXT NOT NULL DEFAULT 'pending',

    rollback_event_id UUID,
    verification_status TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_recovery_requests_tenant
ON runtime_recovery_requests (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_recovery_requests_review
ON runtime_recovery_requests (review_status);

CREATE INDEX IF NOT EXISTS idx_runtime_recovery_requests_execution
ON runtime_recovery_requests (execution_status);

CREATE INDEX IF NOT EXISTS idx_runtime_recovery_requests_quarantine
ON runtime_recovery_requests (quarantine_id);

CREATE INDEX IF NOT EXISTS idx_runtime_recovery_requests_savepoint
ON runtime_recovery_requests (savepoint_id);
