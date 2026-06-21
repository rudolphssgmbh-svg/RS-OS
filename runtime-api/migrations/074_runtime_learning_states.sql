CREATE TABLE IF NOT EXISTS runtime_learning_states (
    learning_state_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    subject_id TEXT NOT NULL,

    knowledge_id TEXT NOT NULL,

    learning_stage TEXT NOT NULL,

    progress_percent NUMERIC(5,2) DEFAULT 0,

    confidence_score NUMERIC(5,2) DEFAULT 0,

    started_at TIMESTAMP,

    updated_at TIMESTAMP,

    created_by TEXT,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_states_tenant
ON runtime_learning_states(tenant_id);

CREATE INDEX IF NOT EXISTS idx_learning_states_subject
ON runtime_learning_states(subject_id);

CREATE INDEX IF NOT EXISTS idx_learning_states_knowledge
ON runtime_learning_states(knowledge_id);
