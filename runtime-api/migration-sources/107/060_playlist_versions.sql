-- RSOS-DS-001 Migration 107 source module
-- Module: 060_playlist_versions.sql
-- Responsibility: versioned and validated signage playlist configuration storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, status checks, validation checks, uniqueness rules, indexes,
-- publication enforcement and comments are implemented in dedicated modules.

CREATE TABLE public.runtime_signage_playlist_versions (
  playlist_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  playlist_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  validation_status TEXT NOT NULL DEFAULT 'pending',
  validation_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum_sha256 TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_by TEXT,
  validated_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
