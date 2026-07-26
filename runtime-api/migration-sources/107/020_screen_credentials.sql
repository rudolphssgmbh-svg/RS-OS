-- RSOS-DS-001 Migration 107 source module
-- Module: 020_screen_credentials.sql
-- Responsibility: hashed player credential lifecycle storage
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Plaintext bearer tokens must never be persisted.
-- token_hash contains the SHA-256 verification representation.
-- token_prefix is non-secret operational identification data.
-- Foreign keys, checks, uniqueness rules, indexes and comments are
-- implemented in their dedicated migration source modules.

CREATE TABLE public.runtime_signage_screen_credentials (
  credential_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  screen_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  rotated_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);
