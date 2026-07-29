async function handleManagementDashboardRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (!(req.method === "GET" && path === "/runtime/dashboard/management")) {
    return false;
  }

  const auth = requireRole(req, [
    "runtime_admin",
    "governance",
    "auditor",
    "system_admin"
  ]);

  if (!auth.allowed) {
    send(res, auth.code, auth.response);
    return true;
  }

  try {
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*)::int FROM runtime_tenants) AS tenant_count,
        (SELECT COUNT(*)::int FROM runtime_tenant_members) AS member_count,
        (SELECT COUNT(*)::int FROM runtime_tenant_domains) AS domain_count,
        (SELECT COUNT(*)::int FROM runtime_objects) AS object_count,
        (SELECT COUNT(*)::int FROM runtime_relations) AS relation_count,
        (SELECT COUNT(*)::int FROM runtime_recommendations) AS recommendation_count,
        (SELECT COUNT(*)::int FROM runtime_orchestrations) AS orchestration_count,
        (SELECT COUNT(*)::int FROM runtime_training_plans) AS training_plan_count,
        (SELECT COUNT(*)::int FROM runtime_learning_evidence) AS learning_evidence_count,
        (SELECT COUNT(*)::int FROM runtime_competencies) AS competency_count,
        (SELECT COUNT(*)::int FROM runtime_governance_decisions) AS governance_decision_count,
        (SELECT COUNT(*)::int FROM runtime_communication_events) AS communication_event_count,
        (SELECT COUNT(*)::int FROM runtime_events) AS audit_event_count
    `);

    send(res, 200, {
      generated_at: new Date().toISOString(),
      scope: "global_management",
      dashboard: result.rows[0]
    });
    return true;
  } catch (err) {
    console.error("RSOS-047C management dashboard failed", err);
    send(res, 500, {
      error: "management_dashboard_failed",
      details: err.message
    });
    return true;
  }
}

module.exports = {
  handleManagementDashboardRoute
};
