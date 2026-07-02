async function handleTenantDashboardDetailRoute({
  req,
  res,
  path,
  db,
  send
}) {
  if (!(req.method === "GET" && path.startsWith("/runtime/dashboard/tenants/"))) {
    return false;
  }

  try {
    const tenantId = decodeURIComponent(
      path.replace("/runtime/dashboard/tenants/", "").split("/")[0]
    );

    if (!tenantId) {
      send(res, 400, {
        error: "tenant_id_required"
      });
      return true;
    }

    const tenantResult = await db.query(`
      SELECT
        tenant_id,
        tenant_name AS name,
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
    `, [tenantId]);

    if (tenantResult.rows.length === 0) {
      send(res, 404, {
        error: "tenant_not_found",
        tenant_id: tenantId
      });
      return true;
    }

    const domainsResult = await db.query(`
      SELECT
        domain_id,
        domain_name,
        domain_role,
        status,
        created_by,
        created_at
      FROM runtime_tenant_domains
      WHERE tenant_id = $1
      ORDER BY created_at ASC
    `, [tenantId]);

    const membersResult = await db.query(`
      SELECT
        member_id,
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
      ORDER BY created_at ASC
    `, [tenantId]);

    const objectsResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_objects
      WHERE tenant_id = $1
    `, [tenantId]);

    const objectsByTypeResult = await db.query(`
      SELECT runtime_type, COUNT(*)::int AS count
      FROM runtime_objects
      WHERE tenant_id = $1
      GROUP BY runtime_type
      ORDER BY count DESC, runtime_type ASC
    `, [tenantId]);

    const relationsResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_relations
      WHERE tenant_id = $1
    `, [tenantId]);

    const recommendationsResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_recommendations
      WHERE tenant_id = $1
    `, [tenantId]);

    const recommendationsByStatusResult = await db.query(`
      SELECT
        COALESCE(status, 'unknown') AS status,
        COUNT(*)::int AS count
      FROM runtime_recommendations
      WHERE tenant_id = $1
      GROUP BY COALESCE(status, 'unknown')
      ORDER BY count DESC, status ASC
    `, [tenantId]);

    const orchestrationsResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_orchestrations
      WHERE tenant_id = $1
    `, [tenantId]);

    const orchestrationsByStatusResult = await db.query(`
      SELECT
        COALESCE(status, 'unknown') AS status,
        COUNT(*)::int AS count
      FROM runtime_orchestrations
      WHERE tenant_id = $1
      GROUP BY COALESCE(status, 'unknown')
      ORDER BY count DESC, status ASC
    `, [tenantId]);

    const trainingPlansResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_training_plans
      WHERE tenant_id = $1
    `, [tenantId]);

    const learningEvidenceResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_learning_evidence
      WHERE tenant_id = $1
    `, [tenantId]);

    const competenciesResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_competencies
      WHERE tenant_id = $1
    `, [tenantId]);

    const governanceDecisionsResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_governance_decisions
      WHERE tenant_id = $1
    `, [tenantId]);

    const governanceApprovalsResult = {
      rows: [{ total: 0 }]
    };

    const communicationEventsResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_communication_events
      WHERE tenant_id = $1
    `, [tenantId]);

    const communicationEvidenceResult = await db.query(`
      SELECT COUNT(*)::int AS total
      FROM runtime_communication_evidence
      WHERE tenant_id = $1
    `, [tenantId]);

    send(res, 200, {
      generated_at: new Date().toISOString(),
      scope: "tenant",
      tenant_id: tenantId,
      tenant: tenantResult.rows[0],
      domains: domainsResult.rows,
      members: membersResult.rows,
      objects: {
        total: objectsResult.rows[0].total,
        by_type: objectsByTypeResult.rows
      },
      relations: {
        total: relationsResult.rows[0].total
      },
      risks: {
        total: 0,
        by_state: []
      },
      recommendations: {
        total: recommendationsResult.rows[0].total,
        by_status: recommendationsByStatusResult.rows
      },
      orchestrations: {
        total: orchestrationsResult.rows[0].total,
        by_status: orchestrationsByStatusResult.rows
      },
      learning: {
        training_plans: trainingPlansResult.rows[0].total,
        learning_evidence: learningEvidenceResult.rows[0].total,
        competencies: competenciesResult.rows[0].total
      },
      governance: {
        decisions: governanceDecisionsResult.rows[0].total,
        approvals: governanceApprovalsResult.rows[0].total
      },
      communication: {
        events: communicationEventsResult.rows[0].total,
        evidence: communicationEvidenceResult.rows[0].total
      }
    });

    return true;
  } catch (err) {
    console.error("RSOS-047B tenant detail dashboard failed", err);
    send(res, 500, {
      error: "tenant_detail_dashboard_failed",
      details: err.message
    });
    return true;
  }
}

module.exports = {
  handleTenantDashboardDetailRoute
};
