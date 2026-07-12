DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM runtime_governance_approvals
    GROUP BY decision_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE =
        'runtime_governance_approvals contains multiple approvals for one decision';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_approvals'::regclass
      AND conname =
        'runtime_governance_approvals_decision_key'
  ) THEN
    ALTER TABLE runtime_governance_approvals
      ADD CONSTRAINT
        runtime_governance_approvals_decision_key
      UNIQUE (
        decision_id
      );
  END IF;
END
$migration$;
