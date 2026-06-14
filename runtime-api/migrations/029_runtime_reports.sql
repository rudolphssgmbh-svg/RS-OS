CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS runtime_reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  source_id uuid NULL,
  evidence_id uuid NULL,
  report_type text NOT NULL,
  title text NOT NULL,
  report_text text NULL,
  report_status text DEFAULT 'captured',
  report_hash text NULL,
  received_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system'
);

CREATE TABLE IF NOT EXISTS runtime_report_segments (
  segment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  report_id uuid REFERENCES runtime_reports(report_id) ON DELETE CASCADE,
  segment_type text NOT NULL,
  segment_text text NOT NULL,
  linked_observation_id uuid NULL,
  linked_evidence_id uuid NULL,
  linked_fact_id uuid NULL,
  linked_assumption_id uuid NULL,
  linked_hypothesis_id uuid NULL,
  confidence numeric DEFAULT 0.50,
  segment_status text DEFAULT 'extracted',
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS idx_runtime_reports_tenant
  ON runtime_reports(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_reports_source
  ON runtime_reports(source_id);

CREATE INDEX IF NOT EXISTS idx_runtime_reports_evidence
  ON runtime_reports(evidence_id);

CREATE INDEX IF NOT EXISTS idx_runtime_report_segments_tenant
  ON runtime_report_segments(tenant_id);

CREATE INDEX IF NOT EXISTS idx_runtime_report_segments_report
  ON runtime_report_segments(report_id);

CREATE INDEX IF NOT EXISTS idx_runtime_report_segments_type
  ON runtime_report_segments(segment_type);
