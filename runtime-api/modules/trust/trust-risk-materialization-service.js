const crypto = require("crypto");

const DEFAULT_VERIFICATION_TYPE =
  "runtime.execution.trust";

function requireNonEmptyString(value, fieldName) {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    throw new Error(
      `invalid_or_missing_${fieldName}`
    );
  }

  return value.trim();
}

function normalizeObservedAt(observedAt) {
  const normalized =
    observedAt instanceof Date
      ? observedAt
      : new Date(observedAt || Date.now());

  if (Number.isNaN(normalized.getTime())) {
    throw new Error("invalid_observed_at");
  }

  return normalized;
}

function buildTrustRiskId({
  verificationType = DEFAULT_VERIFICATION_TYPE,
  sourceEventId,
  anomalyReason
}) {
  const normalizedVerificationType =
    requireNonEmptyString(
      verificationType,
      "verification_type"
    );

  const normalizedSourceEventId =
    requireNonEmptyString(
      sourceEventId,
      "source_event_id"
    );

  const normalizedAnomalyReason =
    requireNonEmptyString(
      anomalyReason,
      "anomaly_reason"
    );

  const canonicalIdentity = [
    normalizedVerificationType,
    normalizedSourceEventId,
    normalizedAnomalyReason
  ].join("\u001f");

  const digest = crypto
    .createHash("sha256")
    .update(canonicalIdentity)
    .digest("hex");

  return `trust-risk-${digest}`;
}

function deriveTrustRiskSeverity(trustResult = {}) {
  if (
    trustResult.chain_valid === false ||
    trustResult.hashes_valid === false
  ) {
    return "blocked";
  }

  return "review_required";
}

function buildTrustRiskMetadata({
  trustResult,
  sourceEvent,
  anomaly,
  observedBy
}) {
  return {
    trust_status:
      trustResult.status || null,

    trust_scope:
      trustResult.scope || null,

    chain_valid:
      typeof trustResult.chain_valid === "boolean"
        ? trustResult.chain_valid
        : null,

    hashes_valid:
      typeof trustResult.hashes_valid === "boolean"
        ? trustResult.hashes_valid
        : null,

    legacy_mode:
      typeof trustResult.legacy_mode === "boolean"
        ? trustResult.legacy_mode
        : null,

    source_previous_hash:
      sourceEvent.previous_hash || null,

    observed_by:
      observedBy || null,

    anomaly_snapshot:
      anomaly
  };
}

async function getSourceEvent({
  db,
  sourceEventId
}) {
  const result = await db.query(`
    SELECT
      event_id,
      event_type,
      object_id,
      tenant_id,
      audit_hash,
      previous_hash,
      created_at
    FROM runtime_events
    WHERE event_id = $1
    LIMIT 1
  `, [
    sourceEventId
  ]);

  if (result.rows.length === 0) {
    throw new Error(
      "trust_risk_source_event_not_found"
    );
  }

  return result.rows[0];
}

async function materializeTrustRisk({
  db,
  trustResult,
  anomaly,
  observedAt = new Date(),
  observedBy = null
}) {
  if (!db || typeof db.query !== "function") {
    throw new Error("invalid_database_client");
  }

  if (!trustResult || typeof trustResult !== "object") {
    throw new Error("invalid_trust_result");
  }

  if (!anomaly || typeof anomaly !== "object") {
    throw new Error("invalid_trust_anomaly");
  }

  const verificationType =
    requireNonEmptyString(
      trustResult.verification ||
        DEFAULT_VERIFICATION_TYPE,
      "verification_type"
    );

  const sourceEventId =
    requireNonEmptyString(
      anomaly.event_id,
      "source_event_id"
    );

  const anomalyReason =
    requireNonEmptyString(
      anomaly.reason,
      "anomaly_reason"
    );

  const normalizedObservedAt =
    normalizeObservedAt(observedAt);

  const sourceEvent = await getSourceEvent({
    db,
    sourceEventId
  });

  const scopeType =
    sourceEvent.tenant_id
      ? "tenant"
      : "global";

  const severity =
    deriveTrustRiskSeverity(trustResult);

  const trustRiskId =
    buildTrustRiskId({
      verificationType,
      sourceEventId,
      anomalyReason
    });

  const expectedAuditHash =
    anomaly.expected_current_v2_hash ||
    anomaly.expected_audit_hash ||
    null;

  const actualAuditHash =
    sourceEvent.audit_hash ||
    anomaly.actual_audit_hash ||
    null;

  const metadata =
    buildTrustRiskMetadata({
      trustResult,
      sourceEvent,
      anomaly,
      observedBy
    });

  const result = await db.query(`
    INSERT INTO runtime_trust_risks (
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
      first_seen_at,
      last_seen_at,
      metadata,
      created_at,
      updated_at
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
      $9,
      $10,
      $11,
      $12,
      $13,
      $13,
      $14::jsonb,
      $13,
      $13
    )
    ON CONFLICT (
      verification_type,
      source_event_id,
      anomaly_reason
    )
    DO UPDATE SET
      scope_type =
        EXCLUDED.scope_type,

      tenant_id =
        EXCLUDED.tenant_id,

      object_id =
        EXCLUDED.object_id,

      source_event_type =
        EXCLUDED.source_event_type,

      source_event_created_at =
        EXCLUDED.source_event_created_at,

      expected_audit_hash =
        EXCLUDED.expected_audit_hash,

      actual_audit_hash =
        EXCLUDED.actual_audit_hash,

      severity =
        EXCLUDED.severity,

      occurrence_count =
        runtime_trust_risks.occurrence_count + 1,

      last_seen_at =
        EXCLUDED.last_seen_at,

      metadata =
        runtime_trust_risks.metadata ||
        EXCLUDED.metadata,

      updated_at =
        EXCLUDED.updated_at
    RETURNING *
  `, [
    trustRiskId,
    verificationType,
    scopeType,
    sourceEvent.tenant_id || null,
    sourceEvent.object_id || null,
    sourceEvent.event_id,
    sourceEvent.event_type || null,
    sourceEvent.created_at || null,
    anomalyReason,
    expectedAuditHash,
    actualAuditHash,
    severity,
    normalizedObservedAt,
    JSON.stringify(metadata)
  ]);

  return result.rows[0];
}

async function materializeExecutionTrustRisks({
  db,
  trustResult,
  observedAt = new Date(),
  observedBy = null
}) {
  if (!trustResult || typeof trustResult !== "object") {
    throw new Error("invalid_trust_result");
  }

  const anomalies =
    Array.isArray(trustResult.anomalies)
      ? trustResult.anomalies
      : [];

  const materializedRisks = [];

  for (const anomaly of anomalies) {
    const materializedRisk =
      await materializeTrustRisk({
        db,
        trustResult,
        anomaly,
        observedAt,
        observedBy
      });

    materializedRisks.push(materializedRisk);
  }

  return {
    verification:
      trustResult.verification ||
      DEFAULT_VERIFICATION_TYPE,

    anomaly_count:
      anomalies.length,

    materialized_count:
      materializedRisks.length,

    trust_risks:
      materializedRisks
  };
}

module.exports = {
  DEFAULT_VERIFICATION_TYPE,
  buildTrustRiskId,
  deriveTrustRiskSeverity,
  materializeExecutionTrustRisks,
  materializeTrustRisk
};
