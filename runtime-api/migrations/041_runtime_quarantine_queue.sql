CREATE TABLE IF NOT EXISTS runtime_quarantine_queue (
    quarantine_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,
    ingress_id UUID NOT NULL REFERENCES runtime_ingress_events(ingress_id),

    quarantine_reason TEXT NOT NULL,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,

    object_id UUID,
    object_type TEXT,

    proposed_action TEXT NOT NULL,
    proposed_payload JSONB NOT NULL,

    detected_by TEXT NOT NULL,
    detection_details JSONB,

    governance_policy_id UUID,
    required_approval_level TEXT,

    status TEXT NOT NULL DEFAULT 'open',

    assigned_to TEXT,
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_decision TEXT,
    review_comment TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_quarantine_tenant
ON runtime_quarantine_queue (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_quarantine_status
ON runtime_quarantine_queue (status);

CREATE INDEX IF NOT EXISTS idx_runtime_quarantine_severity
ON runtime_quarantine_queue (severity);

CREATE INDEX IF NOT EXISTS idx_runtime_quarantine_ingress
ON runtime_quarantine_queue (ingress_id);
