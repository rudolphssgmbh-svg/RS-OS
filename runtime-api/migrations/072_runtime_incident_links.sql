CREATE TABLE IF NOT EXISTS runtime_incident_links (

    incident_link_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    tenant_id TEXT NOT NULL,

    incident_id UUID NOT NULL
      REFERENCES runtime_incidents(incident_id)
      ON DELETE CASCADE,

    linked_type TEXT NOT NULL,
    linked_id UUID NOT NULL,

    relation_type TEXT NOT NULL DEFAULT 'related',

    created_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_incident_links_incident
ON runtime_incident_links(incident_id);

CREATE INDEX IF NOT EXISTS idx_runtime_incident_links_target
ON runtime_incident_links(linked_type, linked_id);

