-- RSOS-DS-001 Migration 107 source module
-- Module: 010_screens.sql
-- Responsibility: runtime signage screen identity and lifecycle storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Cross-table constraints, indexes, immutability rules and comments are
-- implemented in their dedicated migration source modules.

CREATE TABLE public.runtime_signage_screens (
  screen_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  screen_key TEXT NOT NULL,
  screen_name TEXT NOT NULL,
  location_name TEXT,
  status TEXT NOT NULL DEFAULT 'provisioning',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  retired_at TIMESTAMPTZ
);
