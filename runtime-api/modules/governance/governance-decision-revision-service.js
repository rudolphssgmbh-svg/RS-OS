const GOVERNANCE_DECISION_SCOPE_LOCK_PREFIX =
  "rsos.governance_decision_revision.v1";

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

function requireOptionalNonEmptyString(
  value,
  fieldName
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  return requireNonEmptyString(
    value,
    fieldName
  );
}

function requireNonNegativeInteger(
  value,
  fieldName
) {
  const normalized =
    Number(value);

  if (
    !Number.isInteger(normalized) ||
    normalized < 0
  ) {
    throw new Error(
      `invalid_${fieldName}`
    );
  }

  return normalized;
}

function requireReasonCodes(
  reasonCodes
) {
  if (
    reasonCodes === null ||
    typeof reasonCodes !== "object"
  ) {
    throw new Error(
      "invalid_reason_codes"
    );
  }

  return reasonCodes;
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

function buildGovernanceDecisionScopeLockName({
  tenant_id,
  object_id
}) {
  const normalizedTenantId =
    requireNonEmptyString(
      tenant_id,
      "tenant_id"
    );

  const normalizedObjectId =
    requireNonEmptyString(
      object_id,
      "object_id"
    );

  return (
    GOVERNANCE_DECISION_SCOPE_LOCK_PREFIX +
    ":" +
    JSON.stringify([
      normalizedTenantId,
      normalizedObjectId
    ])
  );
}

async function createGovernanceDecisionRevision({
  db,
  writeEvent,
  decision_id,
  object_id,
  tenant_id,
  governance_status,
  reason_codes,
  decision_type,
  created_by = null,
  risk_count = 0,
  max_risk_score = 0,
  acute_risk_count = 0,
  open_action_count = 0,
  high_open_action_count = 0,
  graph_edge_count = 0,
  audit_event_count = 0,
  event_type =
    "runtime.governance_decision.created",
  event_payload = {}
}) {
  const databasePool =
    requireDatabasePool(db);

  const eventWriter =
    requireEventWriter(writeEvent);

  const normalizedDecisionId =
    requireNonEmptyString(
      decision_id,
      "decision_id"
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

  const normalizedGovernanceStatus =
    requireNonEmptyString(
      governance_status,
      "governance_status"
    );

  const normalizedDecisionType =
    requireNonEmptyString(
      decision_type,
      "decision_type"
    );

  const normalizedCreatedBy =
    requireOptionalNonEmptyString(
      created_by,
      "created_by"
    );

  const normalizedEventType =
    requireNonEmptyString(
      event_type,
      "event_type"
    );

  const normalizedReasonCodes =
    requireReasonCodes(reason_codes);

  const normalizedEventPayload =
    requireEventPayload(event_payload);

  const metrics = {
    risk_count:
      requireNonNegativeInteger(
        risk_count,
        "risk_count"
      ),

    max_risk_score:
      requireNonNegativeInteger(
        max_risk_score,
        "max_risk_score"
      ),

    acute_risk_count:
      requireNonNegativeInteger(
        acute_risk_count,
        "acute_risk_count"
      ),

    open_action_count:
      requireNonNegativeInteger(
        open_action_count,
        "open_action_count"
      ),

    high_open_action_count:
      requireNonNegativeInteger(
        high_open_action_count,
        "high_open_action_count"
      ),

    graph_edge_count:
      requireNonNegativeInteger(
        graph_edge_count,
        "graph_edge_count"
      ),

    audit_event_count:
      requireNonNegativeInteger(
        audit_event_count,
        "audit_event_count"
      )
  };

  if (
    metrics.acute_risk_count >
    metrics.risk_count
  ) {
    throw new Error(
      "acute_risk_count_exceeds_risk_count"
    );
  }

  if (
    metrics.high_open_action_count >
    metrics.open_action_count
  ) {
    throw new Error(
      "high_open_action_count_exceeds_open_action_count"
    );
  }

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

    const latestResult =
      await client.query(`
        SELECT
          decision_id,
          revision_number
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
      latestResult.rows[0] || null;

    let revisionNumber = 1;
    let previousDecisionId = null;

    if (latestDecision) {
      const latestRevisionNumber =
        Number(
          latestDecision.revision_number
        );

      if (
        !Number.isInteger(
          latestRevisionNumber
        ) ||
        latestRevisionNumber < 1
      ) {
        throw new Error(
          "invalid_latest_governance_revision"
        );
      }

      previousDecisionId =
        requireNonEmptyString(
          latestDecision.decision_id,
          "previous_decision_id"
        );

      revisionNumber =
        latestRevisionNumber + 1;
    }

    const insertResult =
      await client.query(`
        INSERT INTO runtime_governance_decisions (
          decision_id,
          object_id,
          tenant_id,
          governance_status,
          reason_codes,
          decision_type,
          risk_count,
          max_risk_score,
          acute_risk_count,
          open_action_count,
          high_open_action_count,
          graph_edge_count,
          audit_event_count,
          revision_number,
          previous_decision_id,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5::jsonb,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          $14,
          $15,
          clock_timestamp()
        )
        RETURNING *
      `, [
        normalizedDecisionId,
        normalizedObjectId,
        normalizedTenantId,
        normalizedGovernanceStatus,
        JSON.stringify(
          normalizedReasonCodes
        ),
        normalizedDecisionType,
        metrics.risk_count,
        metrics.max_risk_score,
        metrics.acute_risk_count,
        metrics.open_action_count,
        metrics.high_open_action_count,
        metrics.graph_edge_count,
        metrics.audit_event_count,
        revisionNumber,
        previousDecisionId
      ]);

    const governanceDecision =
      insertResult.rows[0] || null;

    if (!governanceDecision) {
      throw new Error(
        "governance_decision_insert_failed"
      );
    }

    const canonicalEventPayload = {
      ...normalizedEventPayload,

      tenant_id:
        normalizedTenantId,

      object_id:
        normalizedObjectId,

      decision_id:
        normalizedDecisionId,

      governance_status:
        normalizedGovernanceStatus,

      reason_codes:
        normalizedReasonCodes,

      decision_type:
        normalizedDecisionType,

      revision_number:
        revisionNumber,

      previous_decision_id:
        previousDecisionId,

      created_by:
        normalizedCreatedBy
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
        governanceDecision,

      audit_event:
        auditEvent
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original decision-write error.
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  GOVERNANCE_DECISION_SCOPE_LOCK_PREFIX,
  buildGovernanceDecisionScopeLockName,
  createGovernanceDecisionRevision
};
