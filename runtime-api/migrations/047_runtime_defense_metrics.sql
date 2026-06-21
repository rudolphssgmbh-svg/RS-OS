CREATE TABLE IF NOT EXISTS runtime_defense_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,

    metric_date DATE NOT NULL,

    ingress_count INTEGER NOT NULL DEFAULT 0,
    allow_count INTEGER NOT NULL DEFAULT 0,
    shadow_validation_count INTEGER NOT NULL DEFAULT 0,
    quarantine_count INTEGER NOT NULL DEFAULT 0,

    review_count INTEGER NOT NULL DEFAULT 0,
    approved_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,

    recovery_request_count INTEGER NOT NULL DEFAULT 0,
    recovery_completed_count INTEGER NOT NULL DEFAULT 0,

    verification_count INTEGER NOT NULL DEFAULT 0,
    closure_count INTEGER NOT NULL DEFAULT 0,

    avg_risk_score NUMERIC(10,2) DEFAULT 0,
    avg_confidence_score NUMERIC(10,2) DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(tenant_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_runtime_defense_metrics_tenant
ON runtime_defense_metrics (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_defense_metrics_date
ON runtime_defense_metrics (metric_date);
