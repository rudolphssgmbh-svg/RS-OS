-- RSOS-DS-001 Migration 107 source module
-- Module: 030_content.sql
-- Responsibility: tenant-owned signage content identity and lifecycle storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Status checks, content type checks, uniqueness rules, indexes and comments
-- are implemented in their dedicated migration source modules.

CREATE TABLE public.runtime_signage_content (
  content_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  content_key TEXT NOT NULL,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
