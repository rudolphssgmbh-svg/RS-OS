DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM runtime_governance_decisions
    WHERE created_at IS NULL
       OR decision_type IS NULL
       OR length(btrim(decision_type)) = 0
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'runtime_governance_decisions contains invalid metadata values';
  END IF;
END
$migration$;

ALTER TABLE runtime_governance_decisions
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE runtime_governance_decisions
  ALTER COLUMN decision_type SET NOT NULL;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_decision_type_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE runtime_governance_decisions
        ADD CONSTRAINT
          runtime_governance_decisions_decision_type_check
        CHECK (
          length(btrim(decision_type)) > 0
        )
        NOT VALID
    $sql$;
  END IF;
END
$migration$;

ALTER TABLE runtime_governance_decisions
  VALIDATE CONSTRAINT
    runtime_governance_decisions_decision_type_check;
