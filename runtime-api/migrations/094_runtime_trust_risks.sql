-- RSOS-029F Trust Risk Persistence
--
-- Trust and audit-integrity anomalies are intentionally stored separately
-- from runtime_risks. runtime_risks represents operational object and
-- incident risks, while this table represents global or tenant-scoped
-- execution-trust findings.

CREATE TABLE IF NOT EXISTS runtime_trust_risks (
  trust_risk_id TEXT PRIMARY KEY,

  verification_type TEXT NOT NULL
    DEFAULT 'runtime.execution.trust',

  scope_type TEXT NOT NULL
    DEFAULT 'global',

  tenant_id TEXT,
  object_id TEXT,

  source_event_id TEXT NOT NULL,
  source_event_type TEXT,
  source_event_created_at TIMESTAMPTZ,

  anomaly_reason TEXT NOT NULL,

  expected_audit_hash TEXT,
  actual_audit_hash TEXT,

  severity TEXT NOT NULL
    DEFAULT 'review_required',

  risk_state TEXT NOT NULL
    DEFAULT 'open',

  occurrence_count INTEGER NOT NULL
    DEFAULT 1,

  first_seen_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  last_seen_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  resolved_at TIMESTAMPTZ,
  resolution_note TEXT,

  metadata JSONB NOT NULL
    DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  CONSTRAINT runtime_trust_risks_source_key
    UNIQUE (
      verification_type,
      source_event_id,
      anomaly_reason
    ),

  CONSTRAINT runtime_trust_risks_scope_check
    CHECK (
      scope_type IN (
        'global',
        'tenant'
      )
    ),

  CONSTRAINT runtime_trust_risks_scope_tenant_check
    CHECK (
      scope_type = 'global'
      OR (
        scope_type = 'tenant'
        AND tenant_id IS NOT NULL
      )
    ),

  CONSTRAINT runtime_trust_risks_severity_check
    CHECK (
      severity IN (
        'review_required',
        'blocked'
      )
    ),

  CONSTRAINT runtime_trust_risks_state_check
    CHECK (
      risk_state IN (
        'open',
        'acknowledged',
        'resolved'
      )
    ),

  CONSTRAINT runtime_trust_risks_occurrence_check
    CHECK (
      occurrence_count >= 1
    )
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_trust_risks_state_last_seen
ON runtime_trust_risks (
  risk_state,
  last_seen_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_trust_risks_scope_tenant
ON runtime_trust_risks (
  scope_type,
  tenant_id
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_trust_risks_source_event
ON runtime_trust_risks (
  source_event_id
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_trust_risks_object
ON runtime_trust_risks (
  object_id
)
WHERE object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  idx_runtime_trust_risks_metadata_gin
ON runtime_trust_risks
USING GIN (
  metadata
);
