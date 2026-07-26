-- RSOS-DS-001 Migration 107 source module
-- Module: 990_verify.sql
-- Responsibility: fail-closed PostgreSQL catalog verification
-- Generated migration target:
-- runtime-api/migrations/107_runtime_signage_foundation.sql
--
-- This source module is not executable as an independent migration.

DO $verify$
DECLARE
  expected_tables CONSTANT TEXT[] := ARRAY[
    'runtime_signage_content',
    'runtime_signage_content_versions',
    'runtime_signage_player_checkins',
    'runtime_signage_playlist_items',
    'runtime_signage_playlist_versions',
    'runtime_signage_playlists',
    'runtime_signage_publications',
    'runtime_signage_screen_credentials',
    'runtime_signage_screens'
  ];

  expected_constraints CONSTANT TEXT[] := ARRAY[
    'runtime_signage_content_key_not_blank',
    'runtime_signage_content_status_check',
    'runtime_signage_content_tenant_content_id_key',
    'runtime_signage_content_tenant_content_key_key',
    'runtime_signage_content_title_not_blank',
    'runtime_signage_content_type_check',
    'runtime_signage_content_versions_checksum_check',
    'runtime_signage_content_versions_content_fk',
    'runtime_signage_content_versions_duration_check',
    'runtime_signage_content_versions_number_check',
    'runtime_signage_content_versions_number_key',
    'runtime_signage_content_versions_status_check',
    'runtime_signage_content_versions_tenant_id_key',
    'runtime_signage_player_checkins_checksum_check',
    'runtime_signage_player_checkins_credential_fk',
    'runtime_signage_player_checkins_publication_fk',
    'runtime_signage_player_checkins_revision_check',
    'runtime_signage_player_checkins_screen_fk',
    'runtime_signage_player_checkins_status_check',
    'runtime_signage_playlist_items_content_version_fk',
    'runtime_signage_playlist_items_duration_check',
    'runtime_signage_playlist_items_playlist_version_fk',
    'runtime_signage_playlist_items_position_check',
    'runtime_signage_playlist_items_position_key',
    'runtime_signage_playlist_versions_checksum_check',
    'runtime_signage_playlist_versions_number_check',
    'runtime_signage_playlist_versions_number_key',
    'runtime_signage_playlist_versions_playlist_fk',
    'runtime_signage_playlist_versions_status_check',
    'runtime_signage_playlist_versions_tenant_id_key',
    'runtime_signage_playlist_versions_validation_check',
    'runtime_signage_playlists_key_not_blank',
    'runtime_signage_playlists_name_not_blank',
    'runtime_signage_playlists_status_check',
    'runtime_signage_playlists_tenant_playlist_id_key',
    'runtime_signage_playlists_tenant_playlist_key_key',
    'runtime_signage_publications_checksum_check',
    'runtime_signage_publications_playlist_version_fk',
    'runtime_signage_publications_previous_fk',
    'runtime_signage_publications_revision_check',
    'runtime_signage_publications_revision_key',
    'runtime_signage_publications_screen_fk',
    'runtime_signage_publications_status_check',
    'runtime_signage_publications_tenant_id_key',
    'runtime_signage_screen_credentials_screen_fk',
    'runtime_signage_screen_credentials_status_check',
    'runtime_signage_screen_credentials_tenant_id_key',
    'runtime_signage_screen_credentials_token_hash_check',
    'runtime_signage_screen_credentials_token_hash_key',
    'runtime_signage_screens_screen_key_not_blank',
    'runtime_signage_screens_screen_name_not_blank',
    'runtime_signage_screens_status_check',
    'runtime_signage_screens_tenant_screen_id_key',
    'runtime_signage_screens_tenant_screen_key_key'
  ];

  expected_primary_keys CONSTANT TEXT[] := ARRAY[
    'runtime_signage_content_pkey',
    'runtime_signage_content_versions_pkey',
    'runtime_signage_player_checkins_pkey',
    'runtime_signage_playlist_items_pkey',
    'runtime_signage_playlist_versions_pkey',
    'runtime_signage_playlists_pkey',
    'runtime_signage_publications_pkey',
    'runtime_signage_screen_credentials_pkey',
    'runtime_signage_screens_pkey'
  ];

  missing_objects TEXT[];
  unexpected_objects TEXT[];
  actual_count INTEGER;
BEGIN
  SELECT array_agg(expected_name ORDER BY expected_name)
  INTO missing_objects
  FROM unnest(expected_tables) AS expected_name
  WHERE to_regclass('public.' || expected_name) IS NULL;

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'migration 107 verification failed: required tables missing',
      DETAIL = array_to_string(missing_objects, ',');
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_class relation
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND relation.relname = ANY (expected_tables);

  IF actual_count <> 9 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'migration 107 verification failed: table count mismatch',
      DETAIL = 'expected=9 actual=' || actual_count;
  END IF;

  SELECT array_agg(relation.relname ORDER BY relation.relname)
  INTO unexpected_objects
  FROM pg_class relation
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relkind = 'r'
    AND relation.relname LIKE 'runtime_signage_%'
    AND NOT relation.relname = ANY (expected_tables);

  IF unexpected_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'migration 107 verification failed: unexpected signage tables',
      DETAIL = array_to_string(unexpected_objects, ',');
  END IF;

  SELECT array_agg(expected_name ORDER BY expected_name)
  INTO missing_objects
  FROM unnest(expected_tables) AS expected_name
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns column_definition
    WHERE column_definition.table_schema = 'public'
      AND column_definition.table_name = expected_name
      AND column_definition.column_name = 'tenant_id'
      AND column_definition.data_type = 'text'
      AND column_definition.is_nullable = 'NO'
  );

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: tenant_id contract missing',
      DETAIL = array_to_string(missing_objects, ',');
  END IF;

  SELECT array_agg(expected_name ORDER BY expected_name)
  INTO missing_objects
  FROM unnest(expected_constraints) AS expected_name
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_definition
    JOIN pg_class relation
      ON relation.oid = constraint_definition.conrelid
    JOIN pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = ANY (expected_tables)
      AND constraint_definition.conname = expected_name
      AND constraint_definition.convalidated
  );

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: required constraints missing',
      DETAIL = array_to_string(missing_objects, ',');
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_constraint constraint_definition
  JOIN pg_class relation
    ON relation.oid = constraint_definition.conrelid
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY (expected_tables)
    AND constraint_definition.conname = ANY (expected_constraints)
    AND constraint_definition.convalidated;

  IF actual_count <> 54 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: constraint count mismatch',
      DETAIL = 'expected=54 actual=' || actual_count;
  END IF;

  SELECT array_agg(expected_name ORDER BY expected_name)
  INTO missing_objects
  FROM unnest(expected_primary_keys) AS expected_name
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint constraint_definition
    JOIN pg_class relation
      ON relation.oid = constraint_definition.conrelid
    JOIN pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = ANY (expected_tables)
      AND constraint_definition.conname = expected_name
      AND constraint_definition.contype = 'p'
      AND constraint_definition.convalidated
  );

  IF missing_objects IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: primary keys missing',
      DETAIL = array_to_string(missing_objects, ',');
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_constraint constraint_definition
  JOIN pg_class relation
    ON relation.oid = constraint_definition.conrelid
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  JOIN unnest(constraint_definition.conkey)
    WITH ORDINALITY AS key_column(attribute_number, position)
    ON true
  JOIN pg_attribute attribute_definition
    ON attribute_definition.attrelid = relation.oid
   AND attribute_definition.attnum = key_column.attribute_number
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY (expected_tables)
    AND constraint_definition.contype = 'p'
    AND attribute_definition.atttypid = 'uuid'::regtype;

  IF actual_count <> 9 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: UUID primary-key contract invalid',
      DETAIL = 'expected=9 actual=' || actual_count;
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_constraint constraint_definition
  JOIN pg_class relation
    ON relation.oid = constraint_definition.conrelid
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = ANY (expected_tables)
    AND constraint_definition.contype = 'f'
    AND constraint_definition.conname = ANY (expected_constraints)
    AND constraint_definition.confdeltype = 'c';

  IF actual_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: destructive cascade detected',
      DETAIL = 'cascade_foreign_keys=' || actual_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class index_relation
    JOIN pg_namespace namespace
      ON namespace.oid = index_relation.relnamespace
    JOIN pg_index index_definition
      ON index_definition.indexrelid = index_relation.oid
    JOIN pg_class table_relation
      ON table_relation.oid = index_definition.indrelid
    WHERE namespace.nspname = 'public'
      AND index_relation.relname =
        'runtime_signage_screen_credentials_one_active_per_screen'
      AND table_relation.relname =
        'runtime_signage_screen_credentials'
      AND index_definition.indisunique
      AND index_definition.indisvalid
      AND index_definition.indisready
      AND pg_get_expr(
            index_definition.indpred,
            index_definition.indrelid
          ) = '(status = ''active''::text)'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: active credential index invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class index_relation
    JOIN pg_namespace namespace
      ON namespace.oid = index_relation.relnamespace
    JOIN pg_index index_definition
      ON index_definition.indexrelid = index_relation.oid
    JOIN pg_class table_relation
      ON table_relation.oid = index_definition.indrelid
    WHERE namespace.nspname = 'public'
      AND index_relation.relname =
        'runtime_signage_publications_one_current_per_screen'
      AND table_relation.relname =
        'runtime_signage_publications'
      AND index_definition.indisunique
      AND index_definition.indisvalid
      AND index_definition.indisready
      AND pg_get_expr(
            index_definition.indpred,
            index_definition.indrelid
          ) = '(status = ''current''::text)'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: current publication index invalid';
  END IF;

  IF to_regprocedure(
    'public.runtime_signage_reject_player_checkin_mutation()'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: immutability function missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc function_definition
    JOIN pg_namespace namespace
      ON namespace.oid = function_definition.pronamespace
    WHERE namespace.nspname = 'public'
      AND function_definition.proname =
        'runtime_signage_reject_player_checkin_mutation'
      AND function_definition.prorettype = 'trigger'::regtype
      AND function_definition.pronargs = 0
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: immutability function invalid';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger trigger_definition
    JOIN pg_class relation
      ON relation.oid = trigger_definition.tgrelid
    JOIN pg_namespace namespace
      ON namespace.oid = relation.relnamespace
    JOIN pg_proc function_definition
      ON function_definition.oid = trigger_definition.tgfoid
    JOIN pg_namespace function_namespace
      ON function_namespace.oid = function_definition.pronamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'runtime_signage_player_checkins'
      AND trigger_definition.tgname =
        'runtime_signage_player_checkins_append_only'
      AND NOT trigger_definition.tgisinternal
      AND trigger_definition.tgenabled <> 'D'
      AND (trigger_definition.tgtype & 1) = 1
      AND (trigger_definition.tgtype & 16) = 16
      AND (trigger_definition.tgtype & 8) = 8
      AND (trigger_definition.tgtype & 4) = 0
      AND function_namespace.nspname = 'public'
      AND function_definition.proname =
        'runtime_signage_reject_player_checkin_mutation'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: append-only trigger invalid';
  END IF;

  SELECT COUNT(*)
  INTO actual_count
  FROM pg_trigger trigger_definition
  JOIN pg_class relation
    ON relation.oid = trigger_definition.tgrelid
  JOIN pg_namespace namespace
    ON namespace.oid = relation.relnamespace
  WHERE namespace.nspname = 'public'
    AND relation.relname = 'runtime_signage_player_checkins'
    AND trigger_definition.tgname =
      'runtime_signage_player_checkins_append_only'
    AND NOT trigger_definition.tgisinternal;

  IF actual_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 107 verification failed: append-only trigger cardinality',
      DETAIL = 'expected=1 actual=' || actual_count;
  END IF;
END
$verify$;
