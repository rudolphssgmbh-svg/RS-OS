DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM runtime_governance_approvals a
    LEFT JOIN runtime_governance_decisions d
      ON d.decision_id = a.decision_id
    WHERE d.decision_id IS NULL
       OR a.object_id <> d.object_id
       OR a.tenant_id <> d.tenant_id
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'runtime_governance_approvals contains invalid decision scope references';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_scope_key'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE runtime_governance_decisions
        ADD CONSTRAINT
          runtime_governance_decisions_scope_key
        UNIQUE (
          decision_id,
          object_id,
          tenant_id
        )
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_approvals'::regclass
      AND conname =
        'runtime_governance_approvals_decision_scope_fk'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE runtime_governance_approvals
        ADD CONSTRAINT
          runtime_governance_approvals_decision_scope_fk
        FOREIGN KEY (
          decision_id,
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
        NOT VALID
    $sql$;
  END IF;
END
$migration$;

ALTER TABLE runtime_governance_approvals
  VALIDATE CONSTRAINT
    runtime_governance_approvals_decision_scope_fk;
