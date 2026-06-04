ALTER TABLE runtime_knowledge
ADD COLUMN IF NOT EXISTS parent_knowledge_id TEXT;

ALTER TABLE runtime_knowledge
ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE runtime_knowledge
ADD COLUMN IF NOT EXISTS language_code TEXT DEFAULT 'de';

ALTER TABLE runtime_knowledge
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

ALTER TABLE runtime_knowledge
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE runtime_knowledge
ADD COLUMN IF NOT EXISTS created_by TEXT;

ALTER TABLE runtime_knowledge
ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_runtime_knowledge_parent
ON runtime_knowledge(parent_knowledge_id);

CREATE INDEX IF NOT EXISTS idx_runtime_knowledge_status
ON runtime_knowledge(tenant_id, status);
