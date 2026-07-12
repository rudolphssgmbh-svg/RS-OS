DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM runtime_governance_decisions
    WHERE length(btrim(decision_id)) = 0
       OR length(btrim(object_id)) = 0
       OR length(btrim(tenant_id)) = 0
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'runtime_governance_decisions contains blank identity values';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_identity_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE runtime_governance_decisions
        ADD CONSTRAINT
          runtime_governance_decisions_identity_check
        CHECK (
          length(btrim(decision_id)) > 0
          AND length(btrim(object_id)) > 0
          AND length(btrim(tenant_id)) > 0
        )
        NOT VALID
    $sql$;
  END IF;
END
$migration$;

ALTER TABLE runtime_governance_decisions
  VALIDATE CONSTRAINT
    runtime_governance_decisions_identity_check;
