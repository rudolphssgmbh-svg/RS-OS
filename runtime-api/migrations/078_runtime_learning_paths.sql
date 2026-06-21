CREATE TABLE IF NOT EXISTS runtime_learning_paths (
    path_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    subject_id TEXT NOT NULL,

    title TEXT NOT NULL,

    target_competence_id TEXT,

    current_stage TEXT,

    completion_percent NUMERIC(5,2) DEFAULT 0,

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_paths_tenant
ON runtime_learning_paths(tenant_id);

CREATE INDEX IF NOT EXISTS idx_learning_paths_subject
ON runtime_learning_paths(subject_id);

CREATE INDEX IF NOT EXISTS idx_learning_paths_target
ON runtime_learning_paths(target_competence_id);
