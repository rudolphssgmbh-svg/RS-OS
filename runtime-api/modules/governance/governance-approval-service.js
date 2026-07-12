const {
  buildGovernanceDecisionScopeLockName
} = require(
  "./governance-decision-revision-service"
);

const REVIEWABLE_GOVERNANCE_STATUSES =
  new Set([
    "pending_review",
    "review_required"
  ]);

const ALLOWED_APPROVAL_STATUSES =
  new Set([
    "approved",
    "rejected"
  ]);

class GovernanceApprovalServiceError
  extends Error {
  constructor(
    code,
    {
      status = 409,
      details = {}
    } = {}
  ) {
    super(code);

    this.name =
      "GovernanceApprovalServiceError";

    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function requireNonEmptyString(
  value,
  fieldName
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(
      `invalid_${fieldName}`
    );
  }

  return value.trim();
}

function requireEventPayload(
  eventPayload
) {
  if (
    eventPayload === null ||
    typeof eventPayload !== "object" ||
    Array.isArray(eventPayload)
  ) {
    throw new Error(
      "invalid_event_payload"
    );
  }

  return eventPayload;
}

function requireDatabasePool(db) {
  if (
    !db ||
    typeof db.connect !== "function"
  ) {
    throw new Error(
      "invalid_database_pool"
    );
  }

  return db;
}

function requireTransactionClient(
  client
) {
  if (
    !client ||
    typeof client.query !== "function" ||
    typeof client.release !== "function"
  ) {
    throw new Error(
      "invalid_database_transaction_client"
    );
  }

  return client;
}

function requireEventWriter(
  writeEvent
) {
  if (
    typeof writeEvent !== "function"
  ) {
    throw new Error(
      "invalid_runtime_event_writer"
    );
  }

  return writeEvent;
}

function requireApprovalStatus(
  approvalStatus
) {
  const normalized =
    requireNonEmptyString(
      approvalStatus,
      "approval_status"
    );

  if (
    !ALLOWED_APPROVAL_STATUSES.has(
      normalized
    )
  ) {
    throw new Error(
      "invalid_approval_status"
    );
  }

  return normalized;
}

function requireRevisionNumber(
  revisionNumber
) {
  const normalized =
    Number(revisionNumber);

  if (
    !Number.isInteger(normalized) ||
    normalized < 1
  ) {
    throw new Error(
      "invalid_governance_revision_number"
    );
  }

  return normalized;
}

async function createGovernanceApproval({
  db,
  writeEvent,
  approval_id,
  object_id,
  tenant_id,
  approval_status,
  reason,
  requested_by,
  decided_by,
  event_type =
    "runtime.governance_approval.created",
  event_payload = {}
}) {
  const databasePool =
    requireDatabasePool(db);

  const eventWriter =
    requireEventWriter(writeEvent);

  const normalizedApprovalId =
    requireNonEmptyString(
      approval_id,
      "approval_id"
    );

  const normalizedObjectId =
    requireNonEmptyString(
      object_id,
      "object_id"
    );

  const normalizedTenantId =
    requireNonEmptyString(
      tenant_id,
      "tenant_id"
    );

  const normalizedApprovalStatus =
    requireApprovalStatus(
      approval_status
    );

  const normalizedReason =
    requireNonEmptyString(
      reason,
      "reason"
    );

  const normalizedRequestedBy =
    requireNonEmptyString(
      requested_by,
      "requested_by"
    );

  const normalizedDecidedBy =
    requireNonEmptyString(
      decided_by,
      "decided_by"
    );

  const normalizedEventType =
    requireNonEmptyString(
      event_type,
      "event_type"
    );

  const normalizedEventPayload =
    requireEventPayload(
      event_payload
    );

  const scopeLockName =
    buildGovernanceDecisionScopeLockName({
      tenant_id:
        normalizedTenantId,

      object_id:
        normalizedObjectId
    });

  const client =
    requireTransactionClient(
      await databasePool.connect()
    );

  try {
    await client.query("BEGIN");

    await client.query(`
      SELECT pg_advisory_xact_lock(
        hashtextextended($1, 0)
      )
    `, [
      scopeLockName
    ]);

    const latestDecisionResult =
      await client.query(`
        SELECT *
        FROM runtime_governance_decisions
        WHERE tenant_id = $1
          AND object_id = $2
        ORDER BY
          revision_number DESC,
          decision_id DESC
        LIMIT 1
      `, [
        normalizedTenantId,
        normalizedObjectId
      ]);

    const latestDecision =
      latestDecisionResult.rows[0] ||
      null;

    if (!latestDecision) {
      throw new GovernanceApprovalServiceError(
        "governance_decision_required",
        {
          status: 400,

          details: {
            tenant_id:
              normalizedTenantId,

            object_id:
              normalizedObjectId
          }
        }
      );
    }

    const decisionId =
      requireNonEmptyString(
        latestDecision.decision_id,
        "decision_id"
      );

    const governanceStatus =
      requireNonEmptyString(
        latestDecision.governance_status,
        "governance_status"
      );

    const revisionNumber =
      requireRevisionNumber(
        latestDecision.revision_number
      );

    if (
      !REVIEWABLE_GOVERNANCE_STATUSES.has(
        governanceStatus
      )
    ) {
      throw new GovernanceApprovalServiceError(
        "governance_decision_not_reviewable",
        {
          status: 409,

          details: {
            decision_id:
              decisionId,

            revision_number:
              revisionNumber,

            governance_status:
              governanceStatus,

            allowed_governance_statuses:
              Array.from(
                REVIEWABLE_GOVERNANCE_STATUSES
              )
          }
        }
      );
    }

    const insertResult =
      await client.query(`
        INSERT INTO runtime_governance_approvals (
          approval_id,
          decision_id,
          object_id,
          tenant_id,
          approval_status,
          reason,
          requested_by,
          decided_by,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          clock_timestamp()
        )
        ON CONFLICT (
          decision_id
        )
        DO NOTHING
        RETURNING *
      `, [
        normalizedApprovalId,
        decisionId,
        normalizedObjectId,
        normalizedTenantId,
        normalizedApprovalStatus,
        normalizedReason,
        normalizedRequestedBy,
        normalizedDecidedBy
      ]);

    const governanceApproval =
      insertResult.rows[0] || null;

    if (!governanceApproval) {
      const existingResult =
        await client.query(`
          SELECT *
          FROM runtime_governance_approvals
          WHERE tenant_id = $1
            AND object_id = $2
            AND decision_id = $3
          ORDER BY
            created_at DESC,
            approval_id DESC
          LIMIT 1
        `, [
          normalizedTenantId,
          normalizedObjectId,
          decisionId
        ]);

      const existingApproval =
        existingResult.rows[0] || null;

      throw new GovernanceApprovalServiceError(
        "governance_decision_already_approved",
        {
          status: 409,

          details: {
            decision_id:
              decisionId,

            revision_number:
              revisionNumber,

            approval_id:
              existingApproval
                ? existingApproval.approval_id
                : null,

            approval_status:
              existingApproval
                ? existingApproval.approval_status
                : null
          }
        }
      );
    }

    const canonicalEventPayload = {
      ...normalizedEventPayload,

      tenant_id:
        normalizedTenantId,

      object_id:
        normalizedObjectId,

      decision_id:
        decisionId,

      revision_number:
        revisionNumber,

      approval_id:
        normalizedApprovalId,

      approval_status:
        normalizedApprovalStatus,

      reason:
        normalizedReason,

      requested_by:
        normalizedRequestedBy,

      decided_by:
        normalizedDecidedBy
    };

    const auditEvent =
      await eventWriter({
        tenant_id:
          normalizedTenantId,

        object_id:
          normalizedObjectId,

        event_type:
          normalizedEventType,

        message:
          JSON.stringify(
            canonicalEventPayload
          ),

        event_payload:
          canonicalEventPayload,

        transaction_client:
          client
      });

    await client.query("COMMIT");

    return {
      governance_decision:
        latestDecision,

      governance_approval:
        governanceApproval,

      audit_event:
        auditEvent
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original approval-write error.
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  ALLOWED_APPROVAL_STATUSES,
  GovernanceApprovalServiceError,
  REVIEWABLE_GOVERNANCE_STATUSES,
  createGovernanceApproval
};
