BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $presence$
BEGIN
  IF to_regclass(
    'public.runtime_schema_migrations'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 rollback requires runtime_schema_migrations';
  END IF;
END
$presence$;

LOCK TABLE
  public.runtime_schema_migrations
IN ACCESS EXCLUSIVE MODE;

DO $rollback$
DECLARE
  ledger_row_count BIGINT;
  migration_105_count BIGINT;
  later_migration_count BIGINT;
BEGIN
  IF to_regclass(
    'public.runtime_schema_migrations'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 rollback requires runtime_schema_migrations';
  END IF;

  IF to_regprocedure(
    'public.reject_runtime_schema_migration_mutation()'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 rollback requires append-only function';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid =
          'public.runtime_schema_migrations'::regclass
      AND tgname =
          'runtime_schema_migrations_append_only_trigger'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 rollback requires append-only trigger';
  END IF;

  SELECT COUNT(*)
  INTO ledger_row_count
  FROM public.runtime_schema_migrations;

  SELECT COUNT(*)
  INTO migration_105_count
  FROM public.runtime_schema_migrations
  WHERE migration_key =
        '105_runtime_schema_migrations.sql'

    AND migration_number = 105

    AND migration_name =
        'runtime_schema_migration_ledger'

    AND file_path =
        'runtime-api/migrations/105_runtime_schema_migrations.sql'

    AND migration_sha256 ~
        '^[0-9a-f]{64}$'

    AND source_commit ~
        '^[0-9a-f]{7,40}$'

    AND NULLIF(
          metadata->>'baseline_file_count',
          ''
        )::INTEGER = 84

    AND metadata->>'baseline_manifest_sha256' =
        '735f665397ac7f538abd09e9521d73692448a010c5b7a0f54d45c1ee5704b1e6'

    AND metadata->>'baseline_manifest_algorithm' =
        'sha256-of-sorted-sha256-path-lines'

    AND metadata->>'baseline_last_migration_key' =
        '104_runtime_governance_decision_revisions.sql'

    AND metadata->>'baseline_source_head' =
        'e9e6820'

    AND metadata->>'identity_contract' =
        'full_filename'

    AND NULLIF(
          metadata->>'numeric_prefix_uniqueness',
          ''
        )::BOOLEAN = false

    AND metadata->>'execution_context_contract' =
        'rsos.migration_sha256+rsos.source_commit'

    AND metadata->>'source_commit_strategy' =
        'first_commit_containing_file'

    AND metadata->>'self_checksum_state' =
        'verified_external_input';

  SELECT COUNT(*)
  INTO later_migration_count
  FROM public.runtime_schema_migrations
  WHERE migration_number > 105;

  IF migration_105_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 rollback requires its exact ledger record',
      DETAIL =
        'matching_rows=' ||
        migration_105_count;
  END IF;

  IF later_migration_count <> 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 rollback blocked by later migrations',
      DETAIL =
        'later_migrations=' ||
        later_migration_count;
  END IF;

  IF ledger_row_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 rollback requires bootstrap-only ledger',
      DETAIL =
        'ledger_rows=' ||
        ledger_row_count;
  END IF;
END
$rollback$;

DROP TRIGGER
  runtime_schema_migrations_append_only_trigger
ON public.runtime_schema_migrations;

DROP FUNCTION
  public.reject_runtime_schema_migration_mutation();

DROP TABLE
  public.runtime_schema_migrations;

COMMIT;
