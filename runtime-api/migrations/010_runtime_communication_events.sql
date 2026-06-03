CREATE TABLE IF NOT EXISTS runtime_communication_events (
  communication_event_id text PRIMARY KEY,

  tenant_id text NOT NULL,

  sender_id text NOT NULL,
  receiver_id text NOT NULL,

  direction text NOT NULL,
  message_type text NOT NULL,

  subject text,
  payload jsonb DEFAULT '{}'::jsonb,

  status text NOT NULL DEFAULT 'sent',

  created_by text,
  created_at timestamptz DEFAULT now(),

  acknowledged_by text,
  acknowledged_at timestamptz,

  completed_by text,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_runtime_communication_events_tenant_sender
ON runtime_communication_events (tenant_id, sender_id);

CREATE INDEX IF NOT EXISTS idx_runtime_communication_events_tenant_receiver
ON runtime_communication_events (tenant_id, receiver_id);

CREATE INDEX IF NOT EXISTS idx_runtime_communication_events_status
ON runtime_communication_events (tenant_id, status);
