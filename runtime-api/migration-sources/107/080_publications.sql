-- RSOS-DS-001 Migration 107 source module
-- Module: 080_publications.sql
-- Responsibility: versioned and auditable screen publication state storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, status checks, revision checks, checksum checks, uniqueness
-- rules, serialization enforcement, indexes and comments are implemented
-- in dedicated migration and application modules.

CREATE TABLE public.runtime_signage_publications (
  publication_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  screen_id UUID NOT NULL,
  playlist_version_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'current',
  publication_revision BIGINT NOT NULL,
  configuration_checksum_sha256 TEXT NOT NULL,
  published_by TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  superseded_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  previous_publication_id UUID,
  governance_decision_id UUID,
  publication_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
