const { verifyExecutionTrust } = require("../../modules/trust/execution-trust-service");

async function handleRuntimeDashboardRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (!(req.method === "GET" && path === "/runtime/dashboard")) {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin",
    "auditor"
  ]);

  if (!auth.allowed) {
    send(res, auth.code, auth.response);
    return true;
  }

  const objectsResult = await db.query(`
    SELECT *
    FROM runtime_objects
    WHERE tenant_id = $1
  `, [auth.user.tenant_id]);

  const eventsResult = await db.query(`
    SELECT *
    FROM runtime_events
    WHERE tenant_id = $1
  `, [auth.user.tenant_id]);

  const trustResult = await verifyExecutionTrust({
    db,
    tenantId: auth.user.tenant_id
  });

  const objects = objectsResult.rows;
  const events = eventsResult.rows;

  const activeObjects = objects.filter(
    o => o.state !== "completed"
  );

  const highRiskObjects = objects.filter(
    o => o.risk_score >= 70
  );

  send(res, 200, {
    dashboard: {
      summary: {
        total_objects: objects.length,
        active_objects: activeObjects.length,
        high_risk_objects: highRiskObjects.length,
        total_events: events.length
      },
      trust: {
        verification: trustResult.verification,
        status: trustResult.status,
        trust_score: trustResult.trust_score,
        chain_valid: trustResult.chain_valid,
        hashes_valid: trustResult.hashes_valid,
        legacy_mode: trustResult.legacy_mode,
        anomaly_events: trustResult.anomaly_events,
        current_v2_events: trustResult.current_v2_events,
        global_events_checked: trustResult.global_events_checked,
        tenant_events_checked: trustResult.tenant_events_checked
      },
      objects
    }
  });

  return true;
}

module.exports = {
  handleRuntimeDashboardRoute
};
