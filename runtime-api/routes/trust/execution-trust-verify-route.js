const { createAuditHash } = require("../../evidence/audit-hash");

async function handleExecutionTrustVerifyRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method !== "GET" || path !== "/runtime/execution/verify") {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const tenantId = auth.user.tenant_id;

  const result = await db.query(`
    SELECT
      event_id,
      event_type,
      object_id,
      message,
      audit_hash,
      previous_hash,
      tenant_id,
      created_at
    FROM runtime_events
    ORDER BY created_at ASC, event_id ASC
  `);

  const events = result.rows;

  let chainValid = true;
  let hashesValid = true;

  let brokenChainAt = null;
  let brokenHashAt = null;

  let expectedPreviousHash = null;
  let actualPreviousHash = null;
  let expectedAuditHash = null;
  let actualAuditHash = null;

  let tenantEventsChecked = 0;
  let legacyUnsealedEvents = 0;
  let legacyV1Events = 0;
  let legacyV1bEvents = 0;
  let legacyDuplicateHashEvents = 0;
  let currentV2Events = 0;
  let anomalyEvents = 0;
  const anomalies = [];
  let sealedEventsChecked = 0;

  let previousSealedEvent = null;

  for (const event of events) {
    if (event.tenant_id === tenantId) {
      tenantEventsChecked++;
    }

    const isLegacyUnsealed =
      !event.audit_hash ||
      event.audit_hash === "";

    if (isLegacyUnsealed) {
      legacyUnsealedEvents++;
      continue;
    }

    sealedEventsChecked++;

    const currentV2Hash = createAuditHash({
      event_type: event.event_type,
      object_id: event.object_id,
      message: event.message || "",
      previous_hash: event.previous_hash,
      tenant_id: event.tenant_id
    });

    const legacyV1Hash = createAuditHash({
      event_type: event.event_type,
      object_id: event.object_id,
      message: event.message || ""
    });

    const legacyV1bHash = createAuditHash({
      event_type: event.event_type,
      object_id: event.object_id,
      message: event.message || "",
      previous_hash: event.previous_hash
    });

    const isCurrentV2 = currentV2Hash === event.audit_hash;
    const isLegacyV1 = legacyV1Hash === event.audit_hash;
    const isLegacyV1b = legacyV1bHash === event.audit_hash;

    const isLegacyDuplicateHash =
      previousSealedEvent &&
      event.audit_hash === previousSealedEvent.audit_hash &&
      event.event_type === previousSealedEvent.event_type &&
      event.object_id === previousSealedEvent.object_id &&
      event.message === previousSealedEvent.message;

    if (!isCurrentV2 && !isLegacyV1 && !isLegacyV1b && !isLegacyDuplicateHash) {
      anomalyEvents++;
      anomalies.push({
        event_id: event.event_id,
        event_type: event.event_type,
        object_id: event.object_id,
        reason: "unknown_hash_signature",
        expected_current_v2_hash: currentV2Hash,
        actual_audit_hash: event.audit_hash,
        created_at: event.created_at
      });
      continue;
    }

    if (isLegacyV1) {
      legacyV1Events++;
    }

    if (isLegacyV1b) {
      legacyV1bEvents++;
    }

    if (isLegacyDuplicateHash) {
      legacyDuplicateHashEvents++;
    }

    if (isCurrentV2) {
      currentV2Events++;
    }

    if (isCurrentV2 && previousSealedEvent) {
      if (event.previous_hash !== previousSealedEvent.audit_hash) {
        chainValid = false;
        brokenChainAt = event.event_id;
        expectedPreviousHash = previousSealedEvent.audit_hash;
        actualPreviousHash = event.previous_hash;
        break;
      }
    }

    if (isCurrentV2) {
      previousSealedEvent = event;
    }
  }

  const currentTrustValid =
    chainValid &&
    hashesValid;

  const trustScore =
    currentTrustValid
      ? 100
      : chainValid || hashesValid
        ? 50
        : 0;

  const status =
    anomalyEvents > 0
      ? "legacy_dataset_with_anomalies"
      : legacyUnsealedEvents > 0 || legacyV1Events > 0 || legacyV1bEvents > 0 || legacyDuplicateHashEvents > 0
        ? "legacy_dataset"
        : "verified";

  return send(res, 200, {
    verification: "runtime.execution.trust",
    status,
    tenant_id: tenantId,
    scope: "global_runtime_events_with_legacy_awareness",
    global_events_checked: events.length,
    tenant_events_checked: tenantEventsChecked,
    legacy_unsealed_events: legacyUnsealedEvents,
    legacy_v1_events: legacyV1Events,
    legacy_v1b_events: legacyV1bEvents,
    legacy_duplicate_hash_events: legacyDuplicateHashEvents,
    current_v2_events: currentV2Events,
    anomaly_events: anomalyEvents,
    anomalies: anomalies.slice(0, 25),
    sealed_events_checked: sealedEventsChecked,
    legacy_mode:
      legacyUnsealedEvents > 0 ||
      legacyV1Events > 0 ||
      legacyV1bEvents > 0 ||
      legacyDuplicateHashEvents > 0,
    chain_valid: chainValid,
    hashes_valid: hashesValid,
    trust_score: trustScore,
    broken_chain_at: brokenChainAt,
    broken_hash_at: brokenHashAt,
    expected_previous_hash: expectedPreviousHash,
    actual_previous_hash: actualPreviousHash,
    expected_audit_hash: expectedAuditHash,
    actual_audit_hash: actualAuditHash
  });
}

module.exports = { handleExecutionTrustVerifyRoute };
