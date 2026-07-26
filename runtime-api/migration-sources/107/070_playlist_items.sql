-- RSOS-DS-001 Migration 107 source module
-- Module: 070_playlist_items.sql
-- Responsibility: ordered assignment of content versions to playlist versions
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, ordering constraints, duration checks, uniqueness rules,
-- indexes and comments are implemented in dedicated migration source modules.

CREATE TABLE public.runtime_signage_playlist_items (
  playlist_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  playlist_version_id UUID NOT NULL,
  content_version_id UUID NOT NULL,
  position INTEGER NOT NULL,
  duration_seconds INTEGER,
  transition_type TEXT,
  item_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
