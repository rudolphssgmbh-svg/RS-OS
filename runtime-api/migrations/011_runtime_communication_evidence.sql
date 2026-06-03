CREATE TABLE IF NOT EXISTS runtime_communication_evidence (
  communication_evidence_id text PRIMARY KEY,

  tenant_id text NOT NULL,

  communication_event_id text NOT NULL,

  sender_id text NOT NULL,
  receiver_id text NOT NULL,

  message_type text NOT NULL,

  ack_latency_seconds integer,
  completion_latency_seconds integer,

  effectiveness text NOT NULL,

  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_communication_evidence_receiver
ON runtime_communication_evidence (tenant_id, receiver_id);

CREATE INDEX IF NOT EXISTS idx_runtime_communication_evidence_sender
ON runtime_communication_evidence (tenant_id, sender_id);

CREATE INDEX IF NOT EXISTS idx_runtime_communication_evidence_message_type
ON runtime_communication_evidence (tenant_id, message_type);

CREATE INDEX IF NOT EXISTS idx_runtime_communication_evidence_event
ON runtime_communication_evidence (tenant_id, communication_event_id);
