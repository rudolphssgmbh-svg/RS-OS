CREATE TABLE IF NOT EXISTS runtime_competence_states (
    competence_state_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    subject_id TEXT NOT NULL,

    competence_id TEXT NOT NULL,

    competence_level INTEGER DEFAULT 0,

    confidence_score NUMERIC(5,2) DEFAULT 0,

    evidence_count INTEGER DEFAULT 0,

    gap_score NUMERIC(5,2) DEFAULT 0,

    verified BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_competence_states_tenant
ON runtime_competence_states(tenant_id);

CREATE INDEX IF NOT EXISTS idx_competence_states_subject
ON runtime_competence_states(subject_id);

CREATE INDEX IF NOT EXISTS idx_competence_states_competence
ON runtime_competence_states(competence_id);
