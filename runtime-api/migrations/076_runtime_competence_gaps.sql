CREATE TABLE IF NOT EXISTS runtime_competence_gaps (
    gap_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    subject_id TEXT NOT NULL,

    competence_id TEXT NOT NULL,

    required_level INTEGER NOT NULL,

    actual_level INTEGER NOT NULL,

    gap_score NUMERIC(5,2),

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competence_gaps_tenant
ON runtime_competence_gaps(tenant_id);

CREATE INDEX IF NOT EXISTS idx_competence_gaps_subject
ON runtime_competence_gaps(subject_id);

CREATE INDEX IF NOT EXISTS idx_competence_gaps_competence
ON runtime_competence_gaps(competence_id);
