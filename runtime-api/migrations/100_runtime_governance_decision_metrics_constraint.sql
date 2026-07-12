DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM runtime_governance_decisions
    WHERE risk_count < 0
       OR max_risk_score < 0
       OR acute_risk_count < 0
       OR open_action_count < 0
       OR high_open_action_count < 0
       OR graph_edge_count < 0
       OR audit_event_count < 0
       OR acute_risk_count > risk_count
       OR high_open_action_count > open_action_count
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'runtime_governance_decisions contains invalid metric values';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid =
      'runtime_governance_decisions'::regclass
      AND conname =
        'runtime_governance_decisions_metrics_check'
  ) THEN
    EXECUTE $sql$
      ALTER TABLE runtime_governance_decisions
        ADD CONSTRAINT
          runtime_governance_decisions_metrics_check
        CHECK (
          risk_count >= 0
          AND max_risk_score >= 0
          AND acute_risk_count >= 0
          AND open_action_count >= 0
          AND high_open_action_count >= 0
          AND graph_edge_count >= 0
          AND audit_event_count >= 0
          AND acute_risk_count <= risk_count
          AND high_open_action_count <= open_action_count
        )
        NOT VALID
    $sql$;
  END IF;
END
$migration$;

ALTER TABLE runtime_governance_decisions
  VALIDATE CONSTRAINT
    runtime_governance_decisions_metrics_check;
