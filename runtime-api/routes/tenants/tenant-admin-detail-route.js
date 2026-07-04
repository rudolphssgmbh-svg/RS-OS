async function handleTenantAdminDetailRoute({
  req,
  res,
  path,
  db,
  requireRole,
  send
}) {
    // RSOS-050C Global Tenant Control API - Tenant Detail
    if (req.method === "GET" && path.startsWith("/runtime/admin/tenants/")) {

      const auth = requireRole(req, [
        "system_admin"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      if (auth.user.scope !== "global") {
        return send(res, 403, {
          error: "global_scope_required"
        });
      }

      const tenant_id = decodeURIComponent(
        path.replace("/runtime/admin/tenants/", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const tenantResult = await db.query(`
        SELECT
          tenant_id,
          tenant_name,
          tenant_type,
          status,
          owner_name,
          owner_email,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [tenant_id]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const domainsResult = await db.query(`
        SELECT
          domain_id,
          tenant_id,
          domain_name,
          domain_role,
          status,
          created_by,
          created_at
        FROM runtime_tenant_domains
        WHERE tenant_id = $1
        ORDER BY domain_name ASC
      `, [tenant_id]);

      const membersResult = await db.query(`
        SELECT
          member_id,
          tenant_id,
          username,
          display_name,
          email,
          role,
          status,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenant_members
        WHERE tenant_id = $1
        ORDER BY username ASC
      `, [tenant_id]);

      const credentialsResult = await db.query(`
        SELECT
          credential_id,
          tenant_id,
          username,
          status,
          scope,
          system_role,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_operator_credentials
        WHERE tenant_id = $1
        ORDER BY username ASC
      `, [tenant_id]);

      const statisticsResult = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM runtime_objects WHERE tenant_id = $1) AS objects,
          (SELECT COUNT(*)::int FROM runtime_relations WHERE tenant_id = $1) AS relations,
          0 AS risks,
          (SELECT COUNT(*)::int FROM runtime_recommendations WHERE tenant_id = $1) AS recommendations,
          (SELECT COUNT(*)::int FROM runtime_training_plans WHERE tenant_id = $1) AS training_plans,
          (SELECT COUNT(*)::int FROM runtime_learning_evidence WHERE tenant_id = $1) AS learning_evidence,
          (SELECT COUNT(*)::int FROM runtime_governance_decisions WHERE tenant_id = $1) AS governance_decisions,
          (SELECT COUNT(*)::int FROM runtime_communication_events WHERE tenant_id = $1) AS communication_events
      `, [tenant_id]);

      const learningResult = await db.query(`
        SELECT
          COUNT(*)::int AS competencies,
          COUNT(*) FILTER (WHERE gap > 0)::int AS open_gaps,
          COUNT(*) FILTER (WHERE gap >= 3)::int AS critical_gaps,
          COALESCE(SUM(gap), 0)::int AS total_gap
        FROM runtime_competencies
        WHERE tenant_id = $1
      `, [tenant_id]);

      const evidenceResult = await db.query(`
        SELECT
          COUNT(*)::int AS evidence_count,
          COALESCE(SUM(gap_before - gap_after), 0)::int AS total_gap_reduction,
          COUNT(*) FILTER (WHERE effectiveness = 'positive')::int AS positive_count
        FROM runtime_learning_evidence
        WHERE tenant_id = $1
      `, [tenant_id]);

      const evidence = evidenceResult.rows[0];

      const effectiveness_score =
        evidence.evidence_count > 0
          ? Math.round((evidence.positive_count / evidence.evidence_count) * 100)
          : 0;

      return send(res, 200, {
        tenant: tenantResult.rows[0],
        domains: {
          count: domainsResult.rows.length,
          items: domainsResult.rows
        },
        members: {
          count: membersResult.rows.length,
          items: membersResult.rows
        },
        credentials: {
          count: credentialsResult.rows.length,
          items: credentialsResult.rows
        },
        statistics: statisticsResult.rows[0],
        learning: {
          ...learningResult.rows[0],
          evidence_count: evidence.evidence_count,
          total_gap_reduction: evidence.total_gap_reduction,
          effectiveness_score
        }
      });
    }


  return false;
}

module.exports = {
  handleTenantAdminDetailRoute
};
