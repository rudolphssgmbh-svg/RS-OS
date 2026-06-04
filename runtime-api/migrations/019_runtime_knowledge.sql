CREATE TABLE IF NOT EXISTS runtime_knowledge (
    knowledge_id TEXT PRIMARY KEY,

    tenant_id TEXT NOT NULL,

    knowledge_type TEXT NOT NULL,
    parent_knowledge_id TEXT,

    title TEXT NOT NULL,
    description TEXT,

    content JSONB DEFAULT '{}',

    language_code TEXT DEFAULT 'de',
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',

    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    updated_by TEXT,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_runtime_knowledge_tenant
ON runtime_knowledge(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_knowledge_parent
ON runtime_knowledge(parent_knowledge_id);

CREATE INDEX IF NOT EXISTS idx_runtime_knowledge_type
ON runtime_knowledge(knowledge_type);

CREATE INDEX IF NOT EXISTS idx_runtime_knowledge_tenant_type
ON runtime_knowledge(tenant_id, knowledge_type);

CREATE INDEX IF NOT EXISTS idx_runtime_knowledge_status
ON runtime_knowledge(tenant_id, status);
