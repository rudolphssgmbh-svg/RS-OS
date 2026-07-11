const TRUST_RISK_SELECT = `
  SELECT
    trust_risk_id,
    verification_type,
    scope_type,
    tenant_id,
    object_id,
    source_event_id,
    source_event_type,
    source_event_created_at,
    anomaly_reason,
    expected_audit_hash,
    actual_audit_hash,
    severity,
    risk_state,
    occurrence_count,
    first_seen_at,
    last_seen_at,
    resolved_at,
    resolution_note,
    metadata,
    created_at,
    updated_at
  FROM runtime_trust_risks
`;

class TrustRiskReviewError extends Error {
  constructor({
    code,
    status,
    details = {}
  }) {
    super(code);

    this.name =
      "TrustRiskReviewError";

    this.code =
      code;

    this.status =
      status;

    this.details =
      details;
  }
}

function requireNonEmptyString(
  value,
  fieldName,
  maximumLength = null
) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new TrustRiskReviewError({
      code:
        `invalid_or_missing_${fieldName}`,
      status:
        400
    });
  }

  const normalized =
    value.trim();

  if (
    maximumLength !== null &&
    normalized.length > maximumLength
  ) {
    throw new TrustRiskReviewError({
      code:
        `${fieldName}_too_long`,
      status:
        400,

      details: {
        maximum_length:
          maximumLength
      }
    });
  }

  return normalized;
}

function normalizeReviewTimestamp(value) {
  const normalized =
    value instanceof Date
      ? value
      : new Date(value || Date.now());

  if (Number.isNaN(normalized.getTime())) {
    throw new TrustRiskReviewError({
      code:
        "invalid_review_timestamp",
      status:
        400
    });
  }

  return normalized;
}

async function getTrustRisk({
  db,
  trustRiskId
}) {
  const result = await db.query(`
    ${TRUST_RISK_SELECT}
    WHERE trust_risk_id = $1
    LIMIT 1
  `, [
    trustRiskId
  ]);

  return result.rows[0] || null;
}

async function acknowledgeTrustRisk({
  db,
  trustRiskId,
  acknowledgedBy,
  acknowledgementNote,
  acknowledgedAt = new Date()
}) {
  if (!db || typeof db.query !== "function") {
    throw new Error(
      "invalid_database_client"
    );
  }

  const normalizedTrustRiskId =
    requireNonEmptyString(
      trustRiskId,
      "trust_risk_id",
      256
    );

  const normalizedAcknowledgedBy =
    requireNonEmptyString(
      acknowledgedBy,
      "acknowledged_by",
      256
    );

  const normalizedAcknowledgementNote =
    requireNonEmptyString(
      acknowledgementNote,
      "acknowledgement_note",
      2000
    );

  const normalizedAcknowledgedAt =
    normalizeReviewTimestamp(
      acknowledgedAt
    );

  const updateResult = await db.query(`
    UPDATE runtime_trust_risks
    SET
      risk_state =
        'acknowledged',

      metadata =
        metadata ||
        jsonb_build_object(
          'acknowledged_by',
          $2::text,

          'acknowledged_at',
          $4::timestamptz,

          'acknowledgement_note',
          $3::text
        ),

      updated_at =
        $4::timestamptz

    WHERE trust_risk_id = $1
      AND risk_state = 'open'

    RETURNING *
  `, [
    normalizedTrustRiskId,
    normalizedAcknowledgedBy,
    normalizedAcknowledgementNote,
    normalizedAcknowledgedAt
  ]);

  if (updateResult.rows.length === 1) {
    return updateResult.rows[0];
  }

  const existing =
    await getTrustRisk({
      db,
      trustRiskId:
        normalizedTrustRiskId
    });

  if (!existing) {
    throw new TrustRiskReviewError({
      code:
        "trust_risk_not_found",
      status:
        404,

      details: {
        trust_risk_id:
          normalizedTrustRiskId
      }
    });
  }

  if (
    existing.risk_state ===
    "acknowledged"
  ) {
    throw new TrustRiskReviewError({
      code:
        "trust_risk_already_acknowledged",
      status:
        409,

      details: {
        trust_risk_id:
          normalizedTrustRiskId,

        risk_state:
          existing.risk_state
      }
    });
  }

  if (
    existing.risk_state ===
    "resolved"
  ) {
    throw new TrustRiskReviewError({
      code:
        "trust_risk_already_resolved",
      status:
        409,

      details: {
        trust_risk_id:
          normalizedTrustRiskId,

        risk_state:
          existing.risk_state
      }
    });
  }

  throw new TrustRiskReviewError({
    code:
      "invalid_trust_risk_state",
    status:
      409,

    details: {
      trust_risk_id:
        normalizedTrustRiskId,

      risk_state:
        existing.risk_state
    }
  });
}

async function resolveTrustRisk({
  db,
  trustRiskId,
  resolvedBy,
  resolutionNote,
  resolvedAt = new Date()
}) {
  if (!db || typeof db.query !== "function") {
    throw new Error(
      "invalid_database_client"
    );
  }

  const normalizedTrustRiskId =
    requireNonEmptyString(
      trustRiskId,
      "trust_risk_id",
      256
    );

  const normalizedResolvedBy =
    requireNonEmptyString(
      resolvedBy,
      "resolved_by",
      256
    );

  const normalizedResolutionNote =
    requireNonEmptyString(
      resolutionNote,
      "resolution_note",
      4000
    );

  const normalizedResolvedAt =
    normalizeReviewTimestamp(
      resolvedAt
    );

  const updateResult = await db.query(`
    UPDATE runtime_trust_risks
    SET
      risk_state =
        'resolved',

      resolved_at =
        $4::timestamptz,

      resolution_note =
        $3::text,

      metadata =
        metadata ||
        jsonb_build_object(
          'resolved_by',
          $2::text,

          'resolved_at',
          $4::timestamptz,

          'resolution_note',
          $3::text
        ),

      updated_at =
        $4::timestamptz

    WHERE trust_risk_id = $1
      AND risk_state = 'acknowledged'

    RETURNING *
  `, [
    normalizedTrustRiskId,
    normalizedResolvedBy,
    normalizedResolutionNote,
    normalizedResolvedAt
  ]);

  if (updateResult.rows.length === 1) {
    return updateResult.rows[0];
  }

  const existing =
    await getTrustRisk({
      db,
      trustRiskId:
        normalizedTrustRiskId
    });

  if (!existing) {
    throw new TrustRiskReviewError({
      code:
        "trust_risk_not_found",
      status:
        404,

      details: {
        trust_risk_id:
          normalizedTrustRiskId
      }
    });
  }

  if (existing.risk_state === "open") {
    throw new TrustRiskReviewError({
      code:
        "trust_risk_not_acknowledged",
      status:
        409,

      details: {
        trust_risk_id:
          normalizedTrustRiskId,

        risk_state:
          existing.risk_state,

        required_state:
          "acknowledged"
      }
    });
  }

  if (
    existing.risk_state ===
    "resolved"
  ) {
    throw new TrustRiskReviewError({
      code:
        "trust_risk_already_resolved",
      status:
        409,

      details: {
        trust_risk_id:
          normalizedTrustRiskId,

        risk_state:
          existing.risk_state
      }
    });
  }

  throw new TrustRiskReviewError({
    code:
      "invalid_trust_risk_state",
    status:
      409,

    details: {
      trust_risk_id:
        normalizedTrustRiskId,

      risk_state:
        existing.risk_state
    }
  });
}

module.exports = {
  TRUST_RISK_SELECT,
  TrustRiskReviewError,
  acknowledgeTrustRisk,
  resolveTrustRisk
};
