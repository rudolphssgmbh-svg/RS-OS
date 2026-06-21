CREATE TABLE IF NOT EXISTS runtime_learning_recommendations (
    recommendation_id UUID PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    subject_id TEXT NOT NULL,

    recommendation_type TEXT NOT NULL,

    recommendation_text TEXT NOT NULL,

    confidence_score NUMERIC(5,2) DEFAULT 0,

    status TEXT DEFAULT 'OPEN',

    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_recommendations_tenant
ON runtime_learning_recommendations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_learning_recommendations_subject
ON runtime_learning_recommendations(subject_id);

CREATE INDEX IF NOT EXISTS idx_learning_recommendations_status
ON runtime_learning_recommendations(status);
