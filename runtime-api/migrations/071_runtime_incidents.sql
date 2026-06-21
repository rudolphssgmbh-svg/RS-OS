CREATE TABLE IF NOT EXISTS runtime_incidents (

    incident_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,

    title TEXT NOT NULL,
    description TEXT,

    incident_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',

    owner_user TEXT,

    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    updated_by TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    closed_at TIMESTAMPTZ,

    CONSTRAINT runtime_incidents_status_chk CHECK (
      status IN (
        'open',
        'triage',
        'contained',
        'recovery_requested',
        'recovery_in_progress',
        'verification_pending',
        'verified',
        'closed',
        'cancelled',
        'rejected'
      )
    )
);

CREATE INDEX IF NOT EXISTS idx_runtime_incidents_tenant
ON runtime_incidents(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_incidents_status
ON runtime_incidents(status);

