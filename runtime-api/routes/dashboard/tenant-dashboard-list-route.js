async function handleTenantDashboardListRoute({
  req,
  res,
  path,
  db,
  requireRole
}) {
  if (!(req.method === "GET" && path === "/runtime/dashboard/tenants")) {
    return false;
  }

  const auth = requireRole(req, [
    "runtime_admin",
    "governance",
    "auditor",
    "system_admin"
  ]);

  if (!auth.allowed) {
    res.writeHead(auth.code, {
      "Content-Type": "application/json"
    });
    res.end(JSON.stringify(auth.response));
    return true;
  }

  try {
    const result = await db.query(`
      SELECT
        t.tenant_id,
        t.tenant_name AS name,
        COALESCE(d.domains, 0)::int AS domains,
        COALESCE(m.members, 0)::int AS members,
        COALESCE(o.objects, 0)::int AS objects,
        COALESCE(rel.relations, 0)::int AS relations,
        COALESCE(r.risks, 0)::int AS risks,
        COALESCE(rec.recommendations, 0)::int AS recommendations,
        COALESCE(orch.orchestrations, 0)::int AS orchestrations,
        COALESCE(tp.training_plans, 0)::int AS training_plans,
        COALESCE(le.learning_evidence, 0)::int AS learning_evidence,
        COALESCE(gd.governance_decisions, 0)::int AS governance_decisions,
        COALESCE(ce.communication_events, 0)::int AS communication_events

      FROM runtime_tenants t

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS domains
        FROM runtime_tenant_domains
        GROUP BY tenant_id
      ) d ON d.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS members
        FROM runtime_tenant_members
        GROUP BY tenant_id
      ) m ON m.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS objects
        FROM runtime_objects
        GROUP BY tenant_id
      ) o ON o.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS relations
        FROM runtime_relations
        GROUP BY tenant_id
      ) rel ON rel.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, 0 AS risks FROM runtime_tenants
      ) r ON r.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS recommendations
        FROM runtime_recommendations
        GROUP BY tenant_id
      ) rec ON rec.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS orchestrations
        FROM runtime_orchestrations
        GROUP BY tenant_id
      ) orch ON orch.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS training_plans
        FROM runtime_training_plans
        GROUP BY tenant_id
      ) tp ON tp.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS learning_evidence
        FROM runtime_learning_evidence
        GROUP BY tenant_id
      ) le ON le.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS governance_decisions
        FROM runtime_governance_decisions
        GROUP BY tenant_id
      ) gd ON gd.tenant_id = t.tenant_id

      LEFT JOIN (
        SELECT tenant_id, COUNT(*) AS communication_events
        FROM runtime_communication_events
        GROUP BY tenant_id
      ) ce ON ce.tenant_id = t.tenant_id

      ORDER BY t.tenant_name ASC
    `);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      generated_at: new Date().toISOString(),
      tenants: result.rows
    }));
    return true;
  } catch (err) {
    console.error("RSOS-047 tenant dashboard failed", err);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "tenant_dashboard_failed",
      details: err.message
    }));
    return true;
  }
}

module.exports = {
  handleTenantDashboardListRoute
};
