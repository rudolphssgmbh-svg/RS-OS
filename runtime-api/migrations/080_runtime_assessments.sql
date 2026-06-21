CREATE TABLE IF NOT EXISTS runtime_assessments (
    assessment_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    title TEXT NOT NULL,

    assessment_type TEXT NOT NULL,

    competence_id TEXT,

    qualification_id TEXT,

    passing_score NUMERIC(5,2),

    created_by TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assessments_tenant
ON runtime_assessments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_assessments_competence
ON runtime_assessments(competence_id);

CREATE INDEX IF NOT EXISTS idx_assessments_qualification
ON runtime_assessments(qualification_id);

CREATE INDEX IF NOT EXISTS idx_assessments_type
ON runtime_assessments(assessment_type);
