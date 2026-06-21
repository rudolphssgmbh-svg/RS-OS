CREATE TABLE IF NOT EXISTS runtime_savepoints (
    savepoint_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,

    object_id UUID NOT NULL,
    object_type TEXT NOT NULL,

    created_for_ingress_id UUID
        REFERENCES runtime_ingress_events(ingress_id),

    created_for_action TEXT NOT NULL,

    previous_state JSONB NOT NULL,
    previous_state_hash TEXT NOT NULL,

    runtime_event_id UUID,
    audit_event_id UUID,

    savepoint_reason TEXT NOT NULL,
    criticality TEXT NOT NULL,

    rollback_status TEXT NOT NULL DEFAULT 'available',

    rollback_event_id UUID,
    rolled_back_by TEXT,
    rolled_back_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_savepoints_tenant
ON runtime_savepoints (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_savepoints_object
ON runtime_savepoints (object_id);

CREATE INDEX IF NOT EXISTS idx_runtime_savepoints_ingress
ON runtime_savepoints (created_for_ingress_id);

CREATE INDEX IF NOT EXISTS idx_runtime_savepoints_rollback
ON runtime_savepoints (rollback_status);
