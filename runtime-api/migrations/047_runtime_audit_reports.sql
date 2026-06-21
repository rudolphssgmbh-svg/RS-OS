CREATE TABLE IF NOT EXISTS runtime_audit_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,

    report_type TEXT NOT NULL,
    report_period_start DATE,
    report_period_end DATE,

    report_status TEXT NOT NULL DEFAULT 'generated',

    generated_by TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    report_data JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_audit_reports_tenant
ON runtime_audit_reports (tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_audit_reports_type
ON runtime_audit_reports (report_type);

CREATE INDEX IF NOT EXISTS idx_runtime_audit_reports_generated
ON runtime_audit_reports (generated_at);
