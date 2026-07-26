-- RSOS-DS-001 Migration 107 source module
-- Module: 090_player_checkins.sql
-- Responsibility: append-only signage player operational check-in evidence
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Foreign keys, playback-status checks, revision checks, checksum checks,
-- retention policy, indexes and comments are implemented in dedicated modules.

CREATE TABLE public.runtime_signage_player_checkins (
  checkin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  screen_id UUID NOT NULL,
  credential_id UUID,
  publication_id UUID,
  player_version TEXT,
  device_time TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  playback_status TEXT NOT NULL,
  last_successful_sync_at TIMESTAMPTZ,
  reported_publication_revision BIGINT,
  reported_checksum_sha256 TEXT,
  offline_mode BOOLEAN NOT NULL DEFAULT FALSE,
  diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  network_info JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_code TEXT,
  error_message TEXT
);
