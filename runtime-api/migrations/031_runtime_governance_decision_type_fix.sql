ALTER TABLE runtime_governance_decisions
  ADD COLUMN IF NOT EXISTS decision_type text DEFAULT 'governance_review';
