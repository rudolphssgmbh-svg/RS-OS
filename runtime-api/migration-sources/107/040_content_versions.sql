-- RSOS-DS-001 Migration 107 source module
-- Module: 040_content_versions.sql
-- Responsibility: immutable-version-oriented signage content payload storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, checks, uniqueness rules, indexes, immutability enforcement
-- and comments are implemented in their dedicated migration source modules.

CREATE TABLE public.runtime_signage_content_versions (
  content_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  content_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  source_uri TEXT,
  media_type TEXT,
  content_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  duration_seconds INTEGER,
  checksum_sha256 TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
