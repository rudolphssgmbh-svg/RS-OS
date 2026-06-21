CREATE TABLE IF NOT EXISTS runtime_assessment_attempts (
    attempt_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    assessment_id TEXT NOT NULL,

    subject_id TEXT NOT NULL,

    score NUMERIC(5,2),

    result TEXT,

    started_at TIMESTAMP,

    completed_at TIMESTAMP,

    verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_tenant
ON runtime_assessment_attempts(tenant_id);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment
ON runtime_assessment_attempts(assessment_id);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_subject
ON runtime_assessment_attempts(subject_id);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_result
ON runtime_assessment_attempts(result);
