BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

LOCK TABLE
  runtime_governance_decisions,
  runtime_governance_approvals
IN ACCESS EXCLUSIVE MODE;

DO $rollback$
DECLARE
  decision_count BIGINT;
  approval_count BIGINT;
  required_constraint_count INTEGER;
BEGIN
  IF to_regclass(
    'runtime_governance_decisions'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires runtime_governance_decisions';
  END IF;

  IF to_regclass(
    'runtime_governance_approvals'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires runtime_governance_approvals';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema =
          current_schema()
      AND table_name =
          'runtime_governance_decisions'
      AND column_name =
          'revision_number'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires revision_number';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema =
          current_schema()
      AND table_name =
          'runtime_governance_decisions'
      AND column_name =
          'previous_decision_id'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires previous_decision_id';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid =
          'runtime_governance_decisions'::regclass
      AND tgname =
          'runtime_governance_decisions_revision_guard'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires revision guard trigger';
  END IF;

  IF to_regprocedure(
    'validate_runtime_governance_decision_revision()'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires revision validation function';
  END IF;

  SELECT COUNT(*)
  INTO required_constraint_count
  FROM pg_constraint
  WHERE conrelid =
        'runtime_governance_decisions'::regclass
    AND conname = ANY (
      ARRAY[
        'runtime_governance_decisions_object_revision_key',
        'runtime_governance_decisions_predecessor_check',
        'runtime_governance_decisions_previous_scope_fk',
        'runtime_governance_decisions_revision_number_check',
        'runtime_governance_decisions_self_predecessor_check'
      ]
    );

  IF required_constraint_count <> 5 THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires all revision constraints',
      DETAIL =
        'required=5 actual=' ||
        required_constraint_count;
  END IF;

  IF to_regclass(
    'runtime_governance_decisions_previous_key'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires predecessor uniqueness index';
  END IF;

  IF to_regclass(
    'idx_runtime_governance_decisions_scope_revision'
  ) IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires scope revision index';
  END IF;

  SELECT COUNT(*)
  INTO decision_count
  FROM runtime_governance_decisions;

  SELECT COUNT(*)
  INTO approval_count
  FROM runtime_governance_approvals;

  IF decision_count <> 0
     OR approval_count <> 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE =
        'migration 104 rollback requires empty governance state',
      DETAIL =
        'decisions=' ||
        decision_count ||
        ' approvals=' ||
        approval_count;
  END IF;
END
$rollback$;

DROP TRIGGER
  runtime_governance_decisions_revision_guard
ON runtime_governance_decisions;

DROP FUNCTION
  validate_runtime_governance_decision_revision();

ALTER TABLE runtime_governance_decisions
  DROP CONSTRAINT
    runtime_governance_decisions_previous_scope_fk;

ALTER TABLE runtime_governance_decisions
  DROP CONSTRAINT
    runtime_governance_decisions_object_revision_key;

ALTER TABLE runtime_governance_decisions
  DROP CONSTRAINT
    runtime_governance_decisions_self_predecessor_check;

ALTER TABLE runtime_governance_decisions
  DROP CONSTRAINT
    runtime_governance_decisions_predecessor_check;

ALTER TABLE runtime_governance_decisions
  DROP CONSTRAINT
    runtime_governance_decisions_revision_number_check;

DROP INDEX
  runtime_governance_decisions_previous_key;

DROP INDEX
  idx_runtime_governance_decisions_scope_revision;

ALTER TABLE runtime_governance_decisions
  DROP COLUMN previous_decision_id,
  DROP COLUMN revision_number;

COMMIT;
