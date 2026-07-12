DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM runtime_governance_decisions
    WHERE governance_status NOT IN (
      'pending_review',
      'review_required',
      'allowed',
      'blocked'
    )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'runtime_governance_decisions contains invalid governance_status values';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_status_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE runtime_governance_decisions
        ADD CONSTRAINT
          runtime_governance_decisions_status_check
        CHECK (
          governance_status IN (
            'pending_review',
            'review_required',
            'allowed',
            'blocked'
          )
        )
        NOT VALID
    $sql$;
  END IF;
END
$migration$;

ALTER TABLE runtime_governance_decisions
  VALIDATE CONSTRAINT
    runtime_governance_decisions_status_check;
