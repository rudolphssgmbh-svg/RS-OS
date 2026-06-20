CREATE TABLE IF NOT EXISTS runtime_verification_checks (
    check_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,

    verification_id UUID,
    verification_cycle_id UUID,

    check_type TEXT NOT NULL,
    check_status TEXT NOT NULL DEFAULT 'pending',

    expected_value TEXT,
    observed_value TEXT,

    tolerance TEXT,
    deviation TEXT,

    evidence_id UUID,
    measurement_id UUID,

    check_notes TEXT,

    checked_at TIMESTAMP WITH TIME ZONE,
    checked_by TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by TEXT DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_runtime_verification_checks_tenant
ON runtime_verification_checks(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_verification_checks_verification
ON runtime_verification_checks(verification_id);

CREATE INDEX IF NOT EXISTS idx_runtime_verification_checks_cycle
ON runtime_verification_checks(verification_cycle_id);

CREATE INDEX IF NOT EXISTS idx_runtime_verification_checks_status
ON runtime_verification_checks(check_status);
