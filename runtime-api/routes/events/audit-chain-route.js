const {
  verifyExecutionTrust
} = require("../../modules/trust/execution-trust-service");

async function handleAuditChainVerifyRoute({
  req,
  res,
  db,
  send,
  requireRole
}) {
  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const trustResult = await verifyExecutionTrust({
    db,
    tenantId: auth.user.tenant_id
  });

  const boundaryResult = await db.query(`
    SELECT
      event_id,
      created_at
    FROM runtime_events
    ORDER BY created_at ASC, event_id ASC
  `);

  const events = boundaryResult.rows;

  return send(res, 200, {
    tenant_id: auth.user.tenant_id,

    verification: "runtime.audit.chain",
    trust_verification: trustResult.verification,
    status: trustResult.status,
    scope: trustResult.scope,

    events_checked: trustResult.global_events_checked,
    global_events_checked: trustResult.global_events_checked,
    tenant_events_checked: trustResult.tenant_events_checked,
    sealed_events_checked: trustResult.sealed_events_checked,

    chain_valid: trustResult.chain_valid,
    hashes_valid: trustResult.hashes_valid,
    trust_score: trustResult.trust_score,

    legacy_mode: trustResult.legacy_mode,
    legacy_unsealed_events: trustResult.legacy_unsealed_events,
    legacy_v1_events: trustResult.legacy_v1_events,
    legacy_v1b_events: trustResult.legacy_v1b_events,
    legacy_duplicate_hash_events:
      trustResult.legacy_duplicate_hash_events,
    current_v2_events: trustResult.current_v2_events,

    anomaly_events: trustResult.anomaly_events,
    anomalies: trustResult.anomalies,

    broken_at: trustResult.broken_chain_at,
    broken_chain_at: trustResult.broken_chain_at,
    broken_hash_at: trustResult.broken_hash_at,

    expected_previous_hash:
      trustResult.expected_previous_hash,
    actual_previous_hash:
      trustResult.actual_previous_hash,
    expected_audit_hash:
      trustResult.expected_audit_hash,
    actual_audit_hash:
      trustResult.actual_audit_hash,

    first_event_id:
      events.length > 0
        ? events[0].event_id
        : null,

    last_event_id:
      events.length > 0
        ? events[events.length - 1].event_id
        : null
  });
}

module.exports = {
  handleAuditChainVerifyRoute
};
