BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $precheck$
DECLARE
  required_constraint_count INTEGER;
BEGIN
  IF to_regclass(
    'public.runtime_governance_decisions'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 requires runtime_governance_decisions';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name =
          'runtime_governance_decisions'
      AND column_name =
          'revision_number'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 requires governance revision_number contract';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name =
          'runtime_governance_decisions'
      AND column_name =
          'previous_decision_id'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 requires governance predecessor contract';
  END IF;

  IF to_regprocedure(
    'public.validate_runtime_governance_decision_revision()'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 requires governance revision validation function';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid =
          'public.runtime_governance_decisions'::regclass
      AND tgname =
          'runtime_governance_decisions_revision_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 requires governance revision guard trigger';
  END IF;

  SELECT COUNT(*)
  INTO required_constraint_count
  FROM pg_constraint
  WHERE conrelid =
        'public.runtime_governance_decisions'::regclass
    AND conname = ANY (
      ARRAY[
        'runtime_governance_decisions_object_revision_key',
        'runtime_governance_decisions_predecessor_check',
        'runtime_governance_decisions_previous_scope_fk',
        'runtime_governance_decisions_revision_number_check',
        'runtime_governance_decisions_self_predecessor_check'
      ]
    )
    AND convalidated;

  IF required_constraint_count <> 5 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 105 requires validated migration 104 contract',
      DETAIL =
        'required=5 actual=' ||
        required_constraint_count;
  END IF;
END
$precheck$;

DO $execution_context$
DECLARE
  supplied_migration_sha256 TEXT;
  supplied_source_commit TEXT;
BEGIN
  supplied_migration_sha256 :=
    current_setting(
      'rsos.migration_sha256',
      true
    );

  supplied_source_commit :=
    current_setting(
      'rsos.source_commit',
      true
    );

  IF supplied_migration_sha256 IS NULL
     OR supplied_migration_sha256 !~
        '^[0-9a-f]{64}$'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE =
        'migration 105 requires valid rsos.migration_sha256 execution context';
  END IF;

  IF supplied_source_commit IS NULL
     OR supplied_source_commit !~
        '^[0-9a-f]{7,40}$'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE =
        'migration 105 requires valid rsos.source_commit execution context';
  END IF;
END
$execution_context$;

CREATE TABLE IF NOT EXISTS
  public.runtime_schema_migrations (
    migration_key TEXT PRIMARY KEY,
    migration_number INTEGER NOT NULL,
    migration_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    migration_sha256 TEXT NOT NULL,
    source_commit TEXT NOT NULL,
    execution_mode TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL
      DEFAULT now(),
    applied_by TEXT NOT NULL
      DEFAULT current_user,
    metadata JSONB NOT NULL
      DEFAULT '{}'::jsonb,

    CONSTRAINT
      runtime_schema_migrations_number_check
      CHECK (
        migration_number > 0
      ),

    CONSTRAINT
      runtime_schema_migrations_identity_check
      CHECK (
        length(btrim(migration_key)) > 0
        AND length(btrim(migration_name)) > 0
        AND length(btrim(file_path)) > 0
        AND length(btrim(applied_by)) > 0
      ),

    CONSTRAINT
      runtime_schema_migrations_sha256_check
      CHECK (
        migration_sha256 ~ '^[0-9a-f]{64}$'
      ),

    CONSTRAINT
      runtime_schema_migrations_commit_check
      CHECK (
        source_commit ~ '^[0-9a-f]{7,40}$'
      ),

    CONSTRAINT
      runtime_schema_migrations_mode_check
      CHECK (
        execution_mode = ANY (
          ARRAY[
            'bootstrap',
            'manual',
            'runner',
            'restore'
          ]
        )
      ),

    CONSTRAINT
      runtime_schema_migrations_metadata_check
      CHECK (
        jsonb_typeof(metadata) = 'object'
      ),

    CONSTRAINT
      runtime_schema_migrations_file_path_key
      UNIQUE (
        file_path
      )
  );

CREATE INDEX IF NOT EXISTS
  idx_runtime_schema_migrations_number
ON public.runtime_schema_migrations (
  migration_number,
  applied_at
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_schema_migrations_applied_at
ON public.runtime_schema_migrations (
  applied_at DESC
);

DO $contract$
DECLARE
  required_column_count INTEGER;
  required_default_count INTEGER;
  required_constraint_count INTEGER;
  required_index_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO required_column_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name =
        'runtime_schema_migrations'
    AND (
      (
        column_name = 'migration_key'
        AND data_type = 'text'
        AND is_nullable = 'NO'
      )
      OR
      (
        column_name = 'migration_number'
        AND data_type = 'integer'
        AND is_nullable = 'NO'
      )
      OR
      (
        column_name = 'migration_name'
        AND data_type = 'text'
        AND is_nullable = 'NO'
      )
      OR
      (
        column_name = 'file_path'
        AND data_type = 'text'
        AND is_nullable = 'NO'
      )
      OR
      (
        column_name = 'migration_sha256'
        AND data_type = 'text'
        AND is_nullable = 'NO'
      )
      OR
      (
        column_name = 'source_commit'
        AND data_type = 'text'
        AND is_nullable = 'NO'
      )
      OR
      (
        column_name = 'execution_mode'
        AND data_type = 'text'
        AND is_nullable = 'NO'
      )
      OR
      (
        column_name = 'applied_at'
        AND data_type =
            'timestamp with time zone'
        AND is_nullable = 'NO'
      )
      OR
      (
        column_name = 'applied_by'
        AND data_type = 'text'
        AND is_nullable = 'NO'
      )
      OR
      (
        column_name = 'metadata'
        AND data_type = 'jsonb'
        AND is_nullable = 'NO'
      )
    );

  IF required_column_count <> 10 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'runtime_schema_migrations column contract mismatch',
      DETAIL =
        'required=10 actual=' ||
        required_column_count;
  END IF;

  SELECT COUNT(*)
  INTO required_default_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name =
        'runtime_schema_migrations'
    AND column_name = ANY (
      ARRAY[
        'applied_at',
        'applied_by',
        'metadata'
      ]
    )
    AND column_default IS NOT NULL;

  IF required_default_count <> 3 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'runtime_schema_migrations default contract mismatch',
      DETAIL =
        'required=3 actual=' ||
        required_default_count;
  END IF;

  SELECT COUNT(*)
  INTO required_constraint_count
  FROM pg_constraint
  WHERE conrelid =
        'public.runtime_schema_migrations'::regclass
    AND conname = ANY (
      ARRAY[
        'runtime_schema_migrations_pkey',
        'runtime_schema_migrations_number_check',
        'runtime_schema_migrations_identity_check',
        'runtime_schema_migrations_sha256_check',
        'runtime_schema_migrations_commit_check',
        'runtime_schema_migrations_mode_check',
        'runtime_schema_migrations_metadata_check',
        'runtime_schema_migrations_file_path_key'
      ]
    )
    AND convalidated;

  IF required_constraint_count <> 8 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'runtime_schema_migrations constraint contract mismatch',
      DETAIL =
        'required=8 actual=' ||
        required_constraint_count;
  END IF;

  SELECT COUNT(*)
  INTO required_index_count
  FROM pg_index index_state
  JOIN pg_class index_class
    ON index_class.oid =
       index_state.indexrelid
  JOIN pg_class table_class
    ON table_class.oid =
       index_state.indrelid
  JOIN pg_namespace namespace
    ON namespace.oid =
       table_class.relnamespace
  WHERE namespace.nspname = 'public'
    AND table_class.relname =
        'runtime_schema_migrations'
    AND index_class.relname = ANY (
      ARRAY[
        'idx_runtime_schema_migrations_number',
        'idx_runtime_schema_migrations_applied_at'
      ]
    )
    AND index_state.indisvalid
    AND index_state.indisready;

  IF required_index_count <> 2 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'runtime_schema_migrations index contract mismatch',
      DETAIL =
        'required=2 actual=' ||
        required_index_count;
  END IF;
END
$contract$;

CREATE OR REPLACE FUNCTION
  public.reject_runtime_schema_migration_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE =
      'runtime_schema_migrations is append-only';

  RETURN NULL;
END
$function$;

DROP TRIGGER IF EXISTS
  runtime_schema_migrations_append_only_trigger
ON public.runtime_schema_migrations;

CREATE TRIGGER
  runtime_schema_migrations_append_only_trigger
BEFORE UPDATE OR DELETE OR TRUNCATE
ON public.runtime_schema_migrations
FOR EACH STATEMENT
EXECUTE FUNCTION
  public.reject_runtime_schema_migration_mutation();

DO $record$
DECLARE
  supplied_migration_sha256 TEXT;
  supplied_source_commit TEXT;

  existing_migration_sha256 TEXT;
  existing_source_commit TEXT;
  existing_number INTEGER;
  existing_name TEXT;
  existing_path TEXT;

  existing_baseline_through INTEGER;
  existing_baseline_file_count INTEGER;
  existing_baseline_manifest_sha256 TEXT;
  existing_baseline_manifest_algorithm TEXT;
  existing_baseline_last_migration_key TEXT;
  existing_baseline_source_head TEXT;
  existing_identity_contract TEXT;
  existing_numeric_prefix_uniqueness BOOLEAN;
  existing_execution_context_contract TEXT;
  existing_source_commit_strategy TEXT;
  existing_self_checksum_state TEXT;
BEGIN
  supplied_migration_sha256 :=
    current_setting(
      'rsos.migration_sha256',
      true
    );

  supplied_source_commit :=
    current_setting(
      'rsos.source_commit',
      true
    );

  SELECT
    migration_sha256,
    source_commit,
    migration_number,
    migration_name,
    file_path,

    NULLIF(
      metadata->>'baseline_through',
      ''
    )::INTEGER,

    NULLIF(
      metadata->>'baseline_file_count',
      ''
    )::INTEGER,

    metadata->>'baseline_manifest_sha256',
    metadata->>'baseline_manifest_algorithm',
    metadata->>'baseline_last_migration_key',
    metadata->>'baseline_source_head',
    metadata->>'identity_contract',

    NULLIF(
      metadata->>'numeric_prefix_uniqueness',
      ''
    )::BOOLEAN,

    metadata->>'execution_context_contract',
    metadata->>'source_commit_strategy',
    metadata->>'self_checksum_state'
  INTO
    existing_migration_sha256,
    existing_source_commit,
    existing_number,
    existing_name,
    existing_path,
    existing_baseline_through,
    existing_baseline_file_count,
    existing_baseline_manifest_sha256,
    existing_baseline_manifest_algorithm,
    existing_baseline_last_migration_key,
    existing_baseline_source_head,
    existing_identity_contract,
    existing_numeric_prefix_uniqueness,
    existing_execution_context_contract,
    existing_source_commit_strategy,
    existing_self_checksum_state
  FROM public.runtime_schema_migrations
  WHERE migration_key =
        '105_runtime_schema_migrations.sql';

  IF FOUND THEN
    IF existing_migration_sha256 IS DISTINCT FROM
         supplied_migration_sha256

       OR existing_source_commit IS DISTINCT FROM
          supplied_source_commit

       OR existing_number IS DISTINCT FROM 105

       OR existing_name IS DISTINCT FROM
          'runtime_schema_migration_ledger'

       OR existing_path IS DISTINCT FROM
          'runtime-api/migrations/105_runtime_schema_migrations.sql'

       OR existing_baseline_through IS DISTINCT FROM 104

       OR existing_baseline_file_count IS DISTINCT FROM 84

       OR existing_baseline_manifest_sha256 IS DISTINCT FROM
          '735f665397ac7f538abd09e9521d73692448a010c5b7a0f54d45c1ee5704b1e6'

       OR existing_baseline_manifest_algorithm IS DISTINCT FROM
          'sha256-of-sorted-sha256-path-lines'

       OR existing_baseline_last_migration_key IS DISTINCT FROM
          '104_runtime_governance_decision_revisions.sql'

       OR existing_baseline_source_head IS DISTINCT FROM
          'e9e6820'

       OR existing_identity_contract IS DISTINCT FROM
          'full_filename'

       OR existing_numeric_prefix_uniqueness IS DISTINCT FROM
          false

       OR existing_execution_context_contract IS DISTINCT FROM
          'rsos.migration_sha256+rsos.source_commit'

       OR existing_source_commit_strategy IS DISTINCT FROM
          'first_commit_containing_file'

       OR existing_self_checksum_state IS DISTINCT FROM
          'verified_external_input'
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '55000',
        MESSAGE =
          'migration 105 ledger record conflicts with expected contract';
    END IF;
  ELSE
    INSERT INTO public.runtime_schema_migrations (
      migration_key,
      migration_number,
      migration_name,
      file_path,
      migration_sha256,
      source_commit,
      execution_mode,
      metadata
    )
    VALUES (
      '105_runtime_schema_migrations.sql',
      105,
      'runtime_schema_migration_ledger',
      'runtime-api/migrations/105_runtime_schema_migrations.sql',
      supplied_migration_sha256,
      supplied_source_commit,
      'bootstrap',

      jsonb_build_object(
        'baseline_through',
        104,

        'baseline_file_count',
        84,

        'baseline_manifest_sha256',
        '735f665397ac7f538abd09e9521d73692448a010c5b7a0f54d45c1ee5704b1e6',

        'baseline_manifest_algorithm',
        'sha256-of-sorted-sha256-path-lines',

        'baseline_last_migration_key',
        '104_runtime_governance_decision_revisions.sql',

        'baseline_source_head',
        'e9e6820',

        'identity_contract',
        'full_filename',

        'numeric_prefix_uniqueness',
        false,

        'execution_context_contract',
        'rsos.migration_sha256+rsos.source_commit',

        'source_commit_strategy',
        'first_commit_containing_file',

        'self_checksum_state',
        'verified_external_input'
      )
    );
  END IF;
END
$record$;

COMMIT;
