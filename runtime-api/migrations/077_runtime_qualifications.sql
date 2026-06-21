CREATE TABLE IF NOT EXISTS runtime_qualifications (
    qualification_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    subject_id TEXT NOT NULL,

    qualification_type TEXT,

    title TEXT NOT NULL,

    issuing_authority TEXT,

    valid_from DATE,
    valid_until DATE,

    verification_status TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qualifications_tenant
ON runtime_qualifications(tenant_id);

CREATE INDEX IF NOT EXISTS idx_qualifications_subject
ON runtime_qualifications(subject_id);

CREATE INDEX IF NOT EXISTS idx_qualifications_title
ON runtime_qualifications(title);
