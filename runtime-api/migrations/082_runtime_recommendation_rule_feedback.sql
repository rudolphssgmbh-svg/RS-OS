ALTER TABLE runtime_recommendation_rules
ADD COLUMN IF NOT EXISTS success_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS feedback_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(5,2) NOT NULL DEFAULT 50,
ADD COLUMN IF NOT EXISTS last_feedback_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_runtime_recommendation_rules_confidence
ON runtime_recommendation_rules(tenant_id, confidence_score);
