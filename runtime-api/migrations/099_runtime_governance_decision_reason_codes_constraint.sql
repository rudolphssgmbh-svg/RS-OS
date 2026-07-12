DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM runtime_governance_decisions
    WHERE reason_codes IS NULL
       OR jsonb_typeof(reason_codes)
          NOT IN (
            'array',
            'object'
          )
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'runtime_governance_decisions contains invalid reason_codes values';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_reason_codes_type_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE runtime_governance_decisions
        ADD CONSTRAINT
          runtime_governance_decisions_reason_codes_type_check
        CHECK (
          jsonb_typeof(reason_codes) IN (
            'array',
            'object'
          )
        )
        NOT VALID
    $sql$;
  END IF;
END
$migration$;

ALTER TABLE runtime_governance_decisions
  VALIDATE CONSTRAINT
    runtime_governance_decisions_reason_codes_type_check;
