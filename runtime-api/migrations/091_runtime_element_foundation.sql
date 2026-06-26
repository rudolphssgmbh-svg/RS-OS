-- RSOS-106 Runtime Element Foundation
-- Date: 2026-06-26
-- Purpose: Introduce unified runtime elements, relationships, changes and states.

CREATE TABLE IF NOT EXISTS runtime_elements (
  element_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  element_type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  owner TEXT,
  source_module TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runtime_element_relationships (
  relationship_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  source_element_id TEXT NOT NULL,
  target_element_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  source_module TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runtime_element_changes (
  change_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  element_id TEXT,
  change_type TEXT NOT NULL,
  change_reason TEXT,
  observation TEXT,
  interpretation TEXT,
  hypothesis TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending',
  governance_status TEXT NOT NULL DEFAULT 'pending',
  execution_status TEXT NOT NULL DEFAULT 'pending',
  audit_status TEXT NOT NULL DEFAULT 'pending',
  recovery_possible BOOLEAN NOT NULL DEFAULT true,
  affected_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS runtime_element_states (
  state_id TEXT PRIMARY KEY,
  tenant_id TEXT,
  element_id TEXT NOT NULL,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  change_id TEXT,
  reason TEXT,
  actor TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_elements_tenant ON runtime_elements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_runtime_elements_type ON runtime_elements(element_type);
CREATE INDEX IF NOT EXISTS idx_runtime_elements_status ON runtime_elements(status);

CREATE INDEX IF NOT EXISTS idx_runtime_element_relationships_source ON runtime_element_relationships(source_element_id);
CREATE INDEX IF NOT EXISTS idx_runtime_element_relationships_target ON runtime_element_relationships(target_element_id);
CREATE INDEX IF NOT EXISTS idx_runtime_element_relationships_type ON runtime_element_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_runtime_element_changes_element ON runtime_element_changes(element_id);
CREATE INDEX IF NOT EXISTS idx_runtime_element_changes_status ON runtime_element_changes(verification_status, governance_status, execution_status);

CREATE INDEX IF NOT EXISTS idx_runtime_element_states_element ON runtime_element_states(element_id);
CREATE INDEX IF NOT EXISTS idx_runtime_element_states_change ON runtime_element_states(change_id);
