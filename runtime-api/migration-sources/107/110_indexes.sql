-- RSOS-DS-001 Migration 107 source module
-- Module: 110_indexes.sql
-- Responsibility: normative partial uniqueness indexes
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- General performance indexes are intentionally deferred until supported
-- by observed query plans and governed operational evidence.

CREATE UNIQUE INDEX runtime_signage_screen_credentials_one_active_per_screen
  ON public.runtime_signage_screen_credentials (tenant_id, screen_id)
  WHERE status = 'active';

CREATE UNIQUE INDEX runtime_signage_publications_one_current_per_screen
  ON public.runtime_signage_publications (tenant_id, screen_id)
  WHERE status = 'current';
