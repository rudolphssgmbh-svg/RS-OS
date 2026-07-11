CREATE TABLE IF NOT EXISTS runtime_governance_approvals (
  approval_id TEXT PRIMARY KEY,

  decision_id TEXT NOT NULL,
  object_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,

  approval_status TEXT NOT NULL,
  reason TEXT NOT NULL,

  requested_by TEXT NOT NULL,
  decided_by TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT runtime_governance_approvals_decision_fk
    FOREIGN KEY (
      decision_id
    )
    REFERENCES runtime_governance_decisions (
      decision_id
    )
    ON UPDATE RESTRICT
    ON DELETE RESTRICT,

  CONSTRAINT runtime_governance_approvals_status_check
    CHECK (
      approval_status IN (
        'approved',
        'rejected'
      )
    ),

  CONSTRAINT runtime_governance_approvals_identity_check
    CHECK (
      length(btrim(approval_id)) > 0
      AND length(btrim(decision_id)) > 0
      AND length(btrim(object_id)) > 0
      AND length(btrim(tenant_id)) > 0
    ),

  CONSTRAINT runtime_governance_approvals_actor_check
    CHECK (
      length(btrim(requested_by)) > 0
      AND length(btrim(decided_by)) > 0
    ),

  CONSTRAINT runtime_governance_approvals_reason_check
    CHECK (
      length(btrim(reason)) > 0
    )
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_governance_approvals_decision
ON runtime_governance_approvals (
  decision_id
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_governance_approvals_tenant_decision_time
ON runtime_governance_approvals (
  tenant_id,
  decision_id,
  created_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_governance_approvals_tenant_object_time
ON runtime_governance_approvals (
  tenant_id,
  object_id,
  created_at DESC
);
