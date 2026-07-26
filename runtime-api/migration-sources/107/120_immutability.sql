-- RSOS-DS-001 Migration 107 source module
-- Module: 120_immutability.sql
-- Responsibility: append-only enforcement for player check-in evidence
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.
-- Player check-ins are immutable operational evidence after insertion.
-- Retention and governed deletion are intentionally outside migration 107.

CREATE FUNCTION public.runtime_signage_reject_player_checkin_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION
    'runtime_signage_player_checkins is append-only: % is not permitted',
    TG_OP
    USING ERRCODE = '55000';

  RETURN NULL;
END;
$function$;

CREATE TRIGGER runtime_signage_player_checkins_append_only
BEFORE UPDATE OR DELETE
ON public.runtime_signage_player_checkins
FOR EACH ROW
EXECUTE FUNCTION public.runtime_signage_reject_player_checkin_mutation();
