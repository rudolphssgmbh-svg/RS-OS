ALTER TABLE runtime_governance_decisions
  ADD COLUMN IF NOT EXISTS
    revision_number INTEGER,
  ADD COLUMN IF NOT EXISTS
    previous_decision_id TEXT;

DO $migration$
DECLARE
  null_revision_count BIGINT;
  assigned_revision_count BIGINT;
BEGIN
  SELECT COUNT(*)
  INTO null_revision_count
  FROM runtime_governance_decisions
  WHERE revision_number IS NULL;

  SELECT COUNT(*)
  INTO assigned_revision_count
  FROM runtime_governance_decisions
  WHERE revision_number IS NOT NULL;

  IF null_revision_count > 0
     AND assigned_revision_count > 0
  THEN
    RAISE EXCEPTION USING
      MESSAGE =
        'runtime_governance_decisions contains mixed revision assignment state';
  END IF;
END
$migration$;

WITH ordered_decisions AS (
  SELECT
    decision_id,

    ROW_NUMBER() OVER (
      PARTITION BY
        tenant_id,
        object_id
      ORDER BY
        created_at ASC,
        decision_id ASC
    )::INTEGER AS calculated_revision_number,

    LAG(decision_id) OVER (
      PARTITION BY
        tenant_id,
        object_id
      ORDER BY
        created_at ASC,
        decision_id ASC
    ) AS calculated_previous_decision_id

  FROM runtime_governance_decisions
)
UPDATE runtime_governance_decisions AS decision
SET
  revision_number =
    ordered.calculated_revision_number,

  previous_decision_id =
    ordered.calculated_previous_decision_id

FROM ordered_decisions AS ordered
WHERE decision.decision_id =
      ordered.decision_id
  AND decision.revision_number IS NULL;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM runtime_governance_decisions
    WHERE revision_number IS NULL
       OR revision_number < 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE =
        'runtime_governance_decisions contains invalid revision numbers';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM runtime_governance_decisions
    WHERE (
      revision_number = 1
      AND previous_decision_id IS NOT NULL
    )
    OR (
      revision_number > 1
      AND previous_decision_id IS NULL
    )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE =
        'runtime_governance_decisions contains invalid predecessor cardinality';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM runtime_governance_decisions
    GROUP BY
      tenant_id,
      object_id,
      revision_number
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE =
        'runtime_governance_decisions contains duplicate object revisions';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM runtime_governance_decisions
    WHERE previous_decision_id IS NOT NULL
    GROUP BY previous_decision_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE =
        'runtime_governance_decisions contains branched revision predecessors';
  END IF;
END
$migration$;

ALTER TABLE runtime_governance_decisions
  ALTER COLUMN revision_number
    SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_revision_number_check'
  ) THEN
    ALTER TABLE runtime_governance_decisions
      ADD CONSTRAINT
        runtime_governance_decisions_revision_number_check
      CHECK (
        revision_number >= 1
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_predecessor_check'
  ) THEN
    ALTER TABLE runtime_governance_decisions
      ADD CONSTRAINT
        runtime_governance_decisions_predecessor_check
      CHECK (
        (
          revision_number = 1
          AND previous_decision_id IS NULL
        )
        OR
        (
          revision_number > 1
          AND previous_decision_id IS NOT NULL
        )
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_self_predecessor_check'
  ) THEN
    ALTER TABLE runtime_governance_decisions
      ADD CONSTRAINT
        runtime_governance_decisions_self_predecessor_check
      CHECK (
        previous_decision_id IS NULL
        OR previous_decision_id <> decision_id
      )
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_object_revision_key'
  ) THEN
    ALTER TABLE runtime_governance_decisions
      ADD CONSTRAINT
        runtime_governance_decisions_object_revision_key
      UNIQUE (
        tenant_id,
        object_id,
        revision_number
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_previous_scope_fk'
  ) THEN
    ALTER TABLE runtime_governance_decisions
      ADD CONSTRAINT
        runtime_governance_decisions_previous_scope_fk
      FOREIGN KEY (
        previous_decision_id,
        object_id,
        tenant_id
      )
      REFERENCES runtime_governance_decisions (
        decision_id,
        object_id,
        tenant_id
      )
      ON UPDATE RESTRICT
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END
$migration$;

CREATE UNIQUE INDEX IF NOT EXISTS
  runtime_governance_decisions_previous_key
ON runtime_governance_decisions (
  previous_decision_id
)
WHERE previous_decision_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  idx_runtime_governance_decisions_scope_revision
ON runtime_governance_decisions (
  tenant_id,
  object_id,
  revision_number DESC
);

ALTER TABLE runtime_governance_decisions
  VALIDATE CONSTRAINT
    runtime_governance_decisions_revision_number_check;

ALTER TABLE runtime_governance_decisions
  VALIDATE CONSTRAINT
    runtime_governance_decisions_predecessor_check;

ALTER TABLE runtime_governance_decisions
  VALIDATE CONSTRAINT
    runtime_governance_decisions_self_predecessor_check;

ALTER TABLE runtime_governance_decisions
  VALIDATE CONSTRAINT
    runtime_governance_decisions_previous_scope_fk;

CREATE OR REPLACE FUNCTION
  validate_runtime_governance_decision_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $function$
DECLARE
  predecessor_revision INTEGER;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_governance_decisions_immutable_check',
      MESSAGE =
        'governance decisions are append-only; create a new decision revision';
  END IF;

  IF NEW.previous_decision_id = NEW.decision_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_governance_decisions_self_predecessor_check',
      MESSAGE =
        'governance decision cannot reference itself as predecessor';
  END IF;

  IF NEW.revision_number < 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_governance_decisions_revision_number_check',
      MESSAGE =
        'governance decision revision_number must be at least 1';
  END IF;

  IF NEW.revision_number = 1 THEN
    IF NEW.previous_decision_id IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        CONSTRAINT =
          'runtime_governance_decisions_predecessor_check',
        MESSAGE =
          'governance decision revision 1 cannot have a predecessor';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW.previous_decision_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_governance_decisions_predecessor_check',
      MESSAGE =
        'governance decision revision greater than 1 requires a predecessor';
  END IF;

  SELECT revision_number
  INTO predecessor_revision
  FROM runtime_governance_decisions
  WHERE decision_id =
        NEW.previous_decision_id
    AND object_id =
        NEW.object_id
    AND tenant_id =
        NEW.tenant_id;

  IF predecessor_revision IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      CONSTRAINT =
        'runtime_governance_decisions_previous_scope_fk',
      MESSAGE =
        'governance decision predecessor does not exist in the same scope';
  END IF;

  IF predecessor_revision <>
     NEW.revision_number - 1
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      CONSTRAINT =
        'runtime_governance_decisions_predecessor_sequence_check',
      MESSAGE =
        'governance decision predecessor must be the immediately preceding revision';
  END IF;

  RETURN NEW;
END
$function$;

DROP TRIGGER IF EXISTS
  runtime_governance_decisions_revision_guard
ON runtime_governance_decisions;

CREATE TRIGGER
  runtime_governance_decisions_revision_guard
BEFORE INSERT OR UPDATE OR DELETE
ON runtime_governance_decisions
FOR EACH ROW
EXECUTE FUNCTION
  validate_runtime_governance_decision_revision();
