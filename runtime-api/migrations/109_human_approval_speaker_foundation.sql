-- RSOS migration 109
-- HERMES human approval speaker foundation
--
-- STATUS: DRAFT ONLY
-- DATABASE EXECUTION: NOT APPROVED
-- RUNTIME ACTIVATION: NOT APPROVED
-- VOICE ACTIVATION: NOT APPROVED
--
-- Governance:
-- - JARVIS owns workflow pause and continuation requests.
-- - RAR owns responsibility and semantic scope validation.
-- - AWA owns completeness assessment.
-- - HORUS owns identity and authorization verification.
-- - HERMES presents requests and captures responses only.
-- - ARP owns audit and provenance.
-- - Human approvers retain organizational decision authority.
--
-- Compatibility:
-- - Existing tenant, workflow and trace identifiers are referenced logically.
-- - No parallel workflow engine is created.
-- - No parallel identity system is created.
-- - Existing workflows remain unchanged until a later runtime implementation.
--
-- Rollback guidance:
-- - Before production use, export all HERMES rows and verify no runtime
--   assignment references these tables.
-- - Drop triggers and indexes first, then interaction table, then request table.
-- - Rollback execution requires a separately approved migration.
-- - This file intentionally contains no automatic DOWN execution.

BEGIN;

CREATE TABLE IF NOT EXISTS runtime_human_approval_requests (
    id UUID PRIMARY KEY,

    tenant_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    trace_id UUID NOT NULL,

    requested_by_role TEXT NOT NULL,
    requested_by_instance_id UUID,
    semantic_owner_role TEXT NOT NULL DEFAULT 'RAR',

    approval_type TEXT NOT NULL,
    required_human_role TEXT NOT NULL,
    requested_identity TEXT,

    title TEXT NOT NULL,
    description TEXT NOT NULL,

    risk_level SMALLINT NOT NULL,
    reversible BOOLEAN NOT NULL DEFAULT FALSE,
    human_gate_required BOOLEAN NOT NULL DEFAULT TRUE,

    requested_scope JSONB NOT NULL,
    consequences JSONB NOT NULL,
    evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,

    request_hash TEXT NOT NULL,
    scope_hash TEXT NOT NULL,
    policy_snapshot_hash TEXT NOT NULL,
    role_snapshot_hash TEXT NOT NULL,
    capability_snapshot_hash TEXT NOT NULL,

    status TEXT NOT NULL DEFAULT 'PENDING',
    shadow_mode BOOLEAN NOT NULL DEFAULT TRUE,
    continuation_eligible BOOLEAN NOT NULL DEFAULT FALSE,

    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoked_by TEXT,
    revocation_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    presented_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT runtime_human_approval_requests_risk_level_chk
        CHECK (risk_level BETWEEN 1 AND 5),

    CONSTRAINT runtime_human_approval_requests_status_chk
        CHECK (
            status IN (
                'PENDING',
                'PRESENTED',
                'INFORMATION_REQUESTED',
                'APPROVED',
                'REJECTED',
                'DEFERRED',
                'CANCELLED',
                'AMBIGUOUS',
                'EXPIRED',
                'REVOKED',
                'BLOCKED'
            )
        ),

    CONSTRAINT runtime_human_approval_requests_validity_chk
        CHECK (valid_until > valid_from),

    CONSTRAINT runtime_human_approval_requests_revocation_chk
        CHECK (
            (status <> 'REVOKED')
            OR (
                revoked_at IS NOT NULL
                AND revoked_by IS NOT NULL
                AND revocation_reason IS NOT NULL
            )
        ),

    CONSTRAINT runtime_human_approval_requests_shadow_continuation_chk
        CHECK (
            shadow_mode = FALSE
            OR continuation_eligible = FALSE
        ),

    CONSTRAINT runtime_human_approval_requests_approved_decision_chk
        CHECK (
            status <> 'APPROVED'
            OR decided_at IS NOT NULL
        ),

    CONSTRAINT runtime_human_approval_requests_no_self_approval_chk
        CHECK (
            requested_identity IS NULL
            OR requested_identity <> requested_by_role
        )
);

COMMENT ON TABLE runtime_human_approval_requests IS
'HERMES approval requests. Draft foundation only; no runtime continuation is activated by this migration.';

COMMENT ON COLUMN runtime_human_approval_requests.workflow_id IS
'Logical reference to the existing RSOS workflow identifier. No parallel workflow engine.';

COMMENT ON COLUMN runtime_human_approval_requests.trace_id IS
'Logical reference to the existing RSOS trace identifier.';

COMMENT ON COLUMN runtime_human_approval_requests.shadow_mode IS
'When true, the request may be presented and audited but cannot continue a workflow.';

COMMENT ON COLUMN runtime_human_approval_requests.continuation_eligible IS
'Must remain false in shadow mode. Later runtime logic requires independent HORUS and ARP verification.';

CREATE TABLE IF NOT EXISTS runtime_human_approval_interactions (
    id UUID PRIMARY KEY,

    approval_request_id UUID NOT NULL
        REFERENCES runtime_human_approval_requests(id)
        ON DELETE RESTRICT,

    tenant_id UUID NOT NULL,
    workflow_id UUID NOT NULL,
    trace_id UUID NOT NULL,

    channel TEXT NOT NULL,
    speaker_role TEXT NOT NULL DEFAULT 'HERMES',
    hermes_instance_id UUID,

    language TEXT NOT NULL DEFAULT 'de-DE',
    presented_text TEXT NOT NULL,
    presented_scope_hash TEXT NOT NULL,
    presented_risk_level SMALLINT NOT NULL,
    presented_at TIMESTAMPTZ NOT NULL,

    raw_response_text TEXT,
    interpreted_decision TEXT,
    interpretation_confidence NUMERIC(5,4),
    confirmation_level SMALLINT NOT NULL DEFAULT 0,
    responded_at TIMESTAMPTZ,

    identity_verified BOOLEAN NOT NULL DEFAULT FALSE,
    approver_identity TEXT,
    identity_verification_reference TEXT,

    transcript_hash TEXT NOT NULL,
    audit_event_id UUID,
    signature_reference TEXT,

    previous_interaction_hash TEXT,
    interaction_hash TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT runtime_human_approval_interactions_channel_chk
        CHECK (
            channel IN (
                'WEB',
                'DESKTOP',
                'MOBILE',
                'VOICE',
                'TELEPHONE',
                'TEAMS'
            )
        ),

    CONSTRAINT runtime_human_approval_interactions_decision_chk
        CHECK (
            interpreted_decision IS NULL
            OR interpreted_decision IN (
                'APPROVED',
                'REJECTED',
                'DEFERRED',
                'MORE_INFORMATION',
                'CANCELLED',
                'AMBIGUOUS',
                'EXPIRED',
                'REVOKED'
            )
        ),

    CONSTRAINT runtime_human_approval_interactions_confidence_chk
        CHECK (
            interpretation_confidence IS NULL
            OR (
                interpretation_confidence >= 0
                AND interpretation_confidence <= 1
            )
        ),

    CONSTRAINT runtime_human_approval_interactions_confirmation_level_chk
        CHECK (confirmation_level BETWEEN 0 AND 5),

    CONSTRAINT runtime_human_approval_interactions_risk_level_chk
        CHECK (presented_risk_level BETWEEN 1 AND 5),

    CONSTRAINT runtime_human_approval_interactions_approval_identity_chk
        CHECK (
            interpreted_decision <> 'APPROVED'
            OR (
                identity_verified = TRUE
                AND approver_identity IS NOT NULL
                AND identity_verification_reference IS NOT NULL
                AND responded_at IS NOT NULL
            )
        ),

    CONSTRAINT runtime_human_approval_interactions_ambiguous_not_approved_chk
        CHECK (
            interpreted_decision IS DISTINCT FROM 'APPROVED'
            OR raw_response_text IS NOT NULL
        )
);

COMMENT ON TABLE runtime_human_approval_interactions IS
'Append-only HERMES presentation and response evidence. Runtime writes require later reviewed service logic.';

COMMENT ON COLUMN runtime_human_approval_interactions.presented_scope_hash IS
'Hash of the exact scope presented to the human approver. Must match the request scope hash before continuation.';

COMMENT ON COLUMN runtime_human_approval_interactions.interaction_hash IS
'Canonical hash of the interaction record and previous interaction hash.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_runtime_human_approval_requests_request_hash
    ON runtime_human_approval_requests (request_hash);

CREATE INDEX IF NOT EXISTS ix_runtime_human_approval_requests_pending
    ON runtime_human_approval_requests (
        tenant_id,
        status,
        valid_until
    )
    WHERE status IN (
        'PENDING',
        'PRESENTED',
        'INFORMATION_REQUESTED',
        'DEFERRED'
    );

CREATE INDEX IF NOT EXISTS ix_runtime_human_approval_requests_workflow
    ON runtime_human_approval_requests (
        tenant_id,
        workflow_id,
        trace_id,
        created_at
    );

CREATE INDEX IF NOT EXISTS ix_runtime_human_approval_interactions_request
    ON runtime_human_approval_interactions (
        approval_request_id,
        created_at
    );

CREATE INDEX IF NOT EXISTS ix_runtime_human_approval_interactions_trace
    ON runtime_human_approval_interactions (
        tenant_id,
        workflow_id,
        trace_id,
        created_at
    );

CREATE OR REPLACE FUNCTION rsos_prevent_human_approval_interaction_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'runtime_human_approval_interactions is append-only; mutation is forbidden';
END;
$$;

DROP TRIGGER IF EXISTS trg_runtime_human_approval_interactions_no_update
    ON runtime_human_approval_interactions;

CREATE TRIGGER trg_runtime_human_approval_interactions_no_update
BEFORE UPDATE ON runtime_human_approval_interactions
FOR EACH ROW
EXECUTE FUNCTION rsos_prevent_human_approval_interaction_mutation();

DROP TRIGGER IF EXISTS trg_runtime_human_approval_interactions_no_delete
    ON runtime_human_approval_interactions;

CREATE TRIGGER trg_runtime_human_approval_interactions_no_delete
BEFORE DELETE ON runtime_human_approval_interactions
FOR EACH ROW
EXECUTE FUNCTION rsos_prevent_human_approval_interaction_mutation();

CREATE OR REPLACE FUNCTION rsos_validate_human_approval_request_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status IN (
        'APPROVED',
        'REJECTED',
        'CANCELLED',
        'EXPIRED',
        'REVOKED',
        'BLOCKED'
    ) AND NEW.status <> OLD.status THEN
        RAISE EXCEPTION
            'terminal approval request status cannot be changed: % -> %',
            OLD.status,
            NEW.status;
    END IF;

    IF NEW.status = 'APPROVED' THEN
        IF NEW.shadow_mode THEN
            RAISE EXCEPTION
                'shadow-mode approval request cannot become continuation eligible';
        END IF;

        IF NEW.valid_until <= now() THEN
            RAISE EXCEPTION
                'expired approval request cannot be approved';
        END IF;

        IF NEW.revoked_at IS NOT NULL THEN
            RAISE EXCEPTION
                'revoked approval request cannot be approved';
        END IF;
    END IF;

    IF NEW.scope_hash <> OLD.scope_hash
       AND OLD.presented_at IS NOT NULL THEN
        RAISE EXCEPTION
            'scope hash cannot change after presentation';
    END IF;

    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_runtime_human_approval_requests_transition
    ON runtime_human_approval_requests;

CREATE TRIGGER trg_runtime_human_approval_requests_transition
BEFORE UPDATE ON runtime_human_approval_requests
FOR EACH ROW
EXECUTE FUNCTION rsos_validate_human_approval_request_transition();

COMMIT;

-- End of draft migration 109.
-- Execution remains prohibited until SQL, AWA, RAR, HORUS, VEIT and ARP review.
