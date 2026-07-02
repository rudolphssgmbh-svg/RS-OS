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
      objects
    }
  });

  return true;
}

module.exports = {
  handleRuntimeDashboardRoute
};
