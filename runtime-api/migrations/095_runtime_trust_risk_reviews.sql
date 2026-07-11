-- RSOS-029G Trust Risk Review Journal
--
-- This table records human trust-risk lifecycle transitions separately
-- from runtime_events. It must not participate in the execution audit
-- chain because reviewing a trust anomaly must not mutate or extend the
-- evidence set being verified.
--
-- Rows are append-only. UPDATE, DELETE and TRUNCATE are rejected by a
-- database trigger.

CREATE TABLE IF NOT EXISTS runtime_trust_risk_reviews (
  review_id TEXT PRIMARY KEY,

  trust_risk_id TEXT NOT NULL,

  action TEXT NOT NULL,

  previous_state TEXT NOT NULL,
  new_state TEXT NOT NULL,

  reviewed_by TEXT NOT NULL,
  review_note TEXT NOT NULL,

  reviewed_at TIMESTAMPTZ NOT NULL,

  metadata JSONB NOT NULL
    DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL
    DEFAULT NOW(),

  CONSTRAINT runtime_trust_risk_reviews_risk_fk
    FOREIGN KEY (
      trust_risk_id
    )
    REFERENCES runtime_trust_risks (
      trust_risk_id
    )
    ON DELETE RESTRICT,

  CONSTRAINT runtime_trust_risk_reviews_action_check
    CHECK (
      action IN (
        'acknowledge',
        'resolve'
      )
    ),

  CONSTRAINT runtime_trust_risk_reviews_state_check
    CHECK (
      previous_state IN (
        'open',
        'acknowledged',
        'resolved'
      )
      AND
      new_state IN (
        'open',
        'acknowledged',
        'resolved'
      )
    ),

  CONSTRAINT runtime_trust_risk_reviews_transition_check
    CHECK (
      (
        action = 'acknowledge'
        AND previous_state = 'open'
        AND new_state = 'acknowledged'
      )
      OR
      (
        action = 'resolve'
        AND previous_state = 'acknowledged'
        AND new_state = 'resolved'
      )
    ),

  CONSTRAINT runtime_trust_risk_reviews_actor_check
    CHECK (
      btrim(reviewed_by) <> ''
    ),

  CONSTRAINT runtime_trust_risk_reviews_note_check
    CHECK (
      btrim(review_note) <> ''
    ),

  CONSTRAINT runtime_trust_risk_reviews_transition_key
    UNIQUE (
      trust_risk_id,
      previous_state,
      new_state
    )
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_trust_risk_reviews_risk_time
ON runtime_trust_risk_reviews (
  trust_risk_id,
  reviewed_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_trust_risk_reviews_action_time
ON runtime_trust_risk_reviews (
  action,
  reviewed_at DESC
);

CREATE INDEX IF NOT EXISTS
  idx_runtime_trust_risk_reviews_metadata_gin
ON runtime_trust_risk_reviews
USING GIN (
  metadata
);

CREATE OR REPLACE FUNCTION
  reject_runtime_trust_risk_review_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'runtime_trust_risk_reviews_append_only'
    USING ERRCODE = '55000';

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS
  runtime_trust_risk_reviews_append_only_trigger
ON runtime_trust_risk_reviews;

CREATE TRIGGER
  runtime_trust_risk_reviews_append_only_trigger
BEFORE UPDATE OR DELETE OR TRUNCATE
ON runtime_trust_risk_reviews
FOR EACH STATEMENT
EXECUTE FUNCTION
  reject_runtime_trust_risk_review_mutation();
