CREATE TABLE IF NOT EXISTS runtime_ingress_events (
    ingress_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_id TEXT,
    actor_id TEXT,
    actor_type TEXT,
    request_id TEXT,
    correlation_id TEXT,
    idempotency_key TEXT,
    ingress_channel TEXT NOT NULL,
    ingress_intent TEXT NOT NULL,
    target_object_id UUID,
    target_object_type TEXT,
    target_action TEXT NOT NULL,
    payload JSONB NOT NULL,
    payload_hash TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    defense_status TEXT NOT NULL DEFAULT 'received',
    defense_decision TEXT,
    risk_score NUMERIC(5,2),
    confidence_score NUMERIC(5,2),
    pattern_result JSONB,
    heuristic_result JSONB,
    governance_result JSONB,
    cross_loop_result JSONB,
    audit_event_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_ingress_events_tenant
ON runtime_ingress_events (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_ingress_events_correlation
ON runtime_ingress_events (correlation_id);

CREATE INDEX IF NOT EXISTS idx_runtime_ingress_events_idempotency
ON runtime_ingress_events (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_runtime_ingress_events_status
ON runtime_ingress_events (defense_status);
