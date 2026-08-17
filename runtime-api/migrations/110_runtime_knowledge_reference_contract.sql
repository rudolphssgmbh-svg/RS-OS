-- RSOS Migration 110
-- Runtime Knowledge Reference Contract
--
-- Purpose:
--   Align runtime_knowledge schema with active Runtime API and
--   verification-learning writers.
--
-- Scope:
--   * add logical reference field object_id
--   * add provenance/source field source
--
-- Explicit exclusions:
--   * no foreign key on object_id
--   * no data migration
--   * no runtime code change
--   * no production execution
--
-- Transaction ownership belongs to the RSOS migration runner.

ALTER TABLE public.runtime_knowledge
  ADD COLUMN IF NOT EXISTS object_id TEXT;

ALTER TABLE public.runtime_knowledge
  ADD COLUMN IF NOT EXISTS source TEXT;
