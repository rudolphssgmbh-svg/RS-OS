CREATE TABLE IF NOT EXISTS runtime_incident_lessons (
  lesson_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tenant_id TEXT NOT NULL,
  incident_id UUID NOT NULL REFERENCES runtime_incidents(incident_id) ON DELETE CASCADE,

  lesson_type TEXT NOT NULL DEFAULT 'improvement',
  lesson_summary TEXT NOT NULL,

  root_cause TEXT,
  prevention_action TEXT,
  improvement_action TEXT,

  responsible_user TEXT,
  status TEXT NOT NULL DEFAULT 'open',

  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  verified_by TEXT,
  verified_at TIMESTAMPTZ,

  CONSTRAINT runtime_incident_lessons_status_chk CHECK (
    status IN ('open', 'in_progress', 'implemented', 'verified', 'rejected')
  )
);

CREATE INDEX IF NOT EXISTS idx_runtime_incident_lessons_incident
ON runtime_incident_lessons(tenant_id, incident_id);

CREATE INDEX IF NOT EXISTS idx_runtime_incident_lessons_status
ON runtime_incident_lessons(tenant_id, status);
