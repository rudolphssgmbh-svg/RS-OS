async function handleTenantAdminRoute({
  req,
  res,
  path,
  db,
  requireRole,
  readBody,
  writeEvent,
  send
}) {
    // RSOS-051A Global Dashboard API
    if (req.method === "GET" && path === "/runtime/admin/dashboard") {

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

      const summaryResult = await db.query(`
        SELECT
          (SELECT COUNT(*)::int FROM runtime_tenants) AS tenant_count,
          (SELECT COUNT(*)::int FROM runtime_tenant_members) AS member_count,
          (SELECT COUNT(*)::int FROM runtime_operator_credentials) AS credential_count,
          (SELECT COUNT(*)::int FROM runtime_objects) AS object_count,
          (SELECT COUNT(*)::int FROM runtime_recommendations) AS recommendation_count,
          (SELECT COUNT(*)::int FROM runtime_training_plans) AS training_plan_count,
          (SELECT COUNT(*)::int FROM runtime_learning_evidence) AS learning_evidence_count,
          0 AS risk_count,
          (SELECT COUNT(*)::int FROM runtime_governance_decisions) AS governance_decision_count,
          (SELECT COUNT(*)::int FROM runtime_communication_events) AS communication_event_count,
          (SELECT COUNT(*)::int FROM runtime_events) AS audit_event_count
      `);

      const tenantHealthResult = await db.query(`
        SELECT
          t.tenant_id,
          t.tenant_name,
          t.tenant_type,
          t.status,

          COALESCE(m.members, 0)::int AS members,
          COALESCE(c.credentials, 0)::int AS credentials,
          COALESCE(o.objects, 0)::int AS objects,
          COALESCE(r.recommendations, 0)::int AS recommendations,
          COALESCE(tp.training_plans, 0)::int AS training_plans,
          COALESCE(le.learning_evidence, 0)::int AS learning_evidence,
          COALESCE(risk.risks, 0)::int AS risks

        FROM runtime_tenants t

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS members
          FROM runtime_tenant_members
          GROUP BY tenant_id
        ) m ON m.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS credentials
          FROM runtime_operator_credentials
          GROUP BY tenant_id
        ) c ON c.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS objects
          FROM runtime_objects
          GROUP BY tenant_id
        ) o ON o.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS recommendations
          FROM runtime_recommendations
          GROUP BY tenant_id
        ) r ON r.tenant_id = t.tenant_id

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
          SELECT tenant_id, 0 AS risks FROM runtime_tenants
        ) risk ON risk.tenant_id = t.tenant_id

        ORDER BY t.tenant_name ASC
      `);

      const recentActivityResult = await db.query(`
        SELECT
          event_id,
          event_type,
          object_id,
          tenant_id,
          message,
          created_at
        FROM runtime_events
        ORDER BY created_at DESC
        LIMIT 50
      `);

      return send(res, 200, {
        scope: "global",
        summary: summaryResult.rows[0],
        tenant_health: tenantHealthResult.rows,
        recent_activity: recentActivityResult.rows
      });
    }

    // RSOS-050D Global Tenant Control API - Create Tenant
    if (req.method === "POST" && path === "/runtime/admin/tenants") {

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

      const body = await readBody(req);

      const tenant_id = body.tenant_id;
      const tenant_name = body.tenant_name;
      const tenant_type = body.tenant_type || "business";
      const status = body.status || "active";
      const owner_name = body.owner_name || null;
      const owner_email = body.owner_email || null;
      const domain_name = body.domain_name || null;

      if (!tenant_id || !tenant_name) {
        return send(res, 400, {
          error: "missing_required_tenant_fields",
          required: [
            "tenant_id",
            "tenant_name"
          ]
        });
      }

      const created_by =
        auth.user.operator_id || auth.user.username || "system_admin";

      const existingResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [tenant_id]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "tenant_already_exists",
          tenant_id
        });
      }

      await db.query("BEGIN");

      try {
        const tenantResult = await db.query(`
          INSERT INTO runtime_tenants (
            tenant_id,
            tenant_name,
            tenant_type,
            status,
            owner_name,
            owner_email,
            created_by
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING *
        `, [
          tenant_id,
          tenant_name,
          tenant_type,
          status,
          owner_name,
          owner_email,
          created_by
        ]);

        let domain = null;

        if (domain_name) {
          const domain_id =
            "dom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

          const domainResult = await db.query(`
            INSERT INTO runtime_tenant_domains (
              domain_id,
              tenant_id,
              domain_name,
              domain_role,
              status,
              created_by
            )
            VALUES ($1,$2,$3,'primary','active',$4)
            RETURNING *
          `, [
            domain_id,
            tenant_id,
            domain_name,
            created_by
          ]);

          domain = domainResult.rows[0];
        }

        await writeEvent({
          tenant_id: auth.user.tenant_id,
          object_id: tenant_id,
          event_type: "runtime.admin.tenant.created",
          message: "Tenant created by system admin: " + tenant_name
        });

        await db.query("COMMIT");

        return send(res, 200, {
          created: true,
          tenant: tenantResult.rows[0],
          domain
        });

      } catch (err) {
        await db.query("ROLLBACK");
        throw err;
      }
    }


    // RSOS-050E Global Tenant Control API - Create Tenant Member
    if (req.method === "POST" && path.startsWith("/runtime/admin/tenants/") && path.endsWith("/members")) {

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
        path
          .replace("/runtime/admin/tenants/", "")
          .replace("/members", "")
      );

      const body = await readBody(req);

      const username = body.username;
      const display_name = body.display_name || username;
      const email = body.email || null;
      const role = body.role || "tenant_admin";
      const status = body.status || "active";

      if (!tenant_id || !username) {
        return send(res, 400, {
          error: "missing_required_member_fields",
          required: [
            "tenant_id",
            "username"
          ]
        });
      }

      const tenantResult = await db.query(`
        SELECT tenant_id
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

      const existingResult = await db.query(`
        SELECT member_id
        FROM runtime_tenant_members
        WHERE tenant_id = $1
          AND username = $2
        LIMIT 1
      `, [
        tenant_id,
        username
      ]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "tenant_member_already_exists",
          tenant_id,
          username
        });
      }

      const member_id =
        "mem-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "system_admin";

      const insertResult = await db.query(`
        INSERT INTO runtime_tenant_members (
          member_id,
          tenant_id,
          username,
          display_name,
          email,
          role,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING *
      `, [
        member_id,
        tenant_id,
        username,
        display_name,
        email,
        role,
        status,
        created_by
      ]);

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.admin.tenant_member.created",
        message: "Tenant member created: " + username
      });

      return send(res, 200, {
        created: true,
        member: insertResult.rows[0]
      });
    }


    // RSOS-050F Global Tenant Control API - Create Credential
    if (req.method === "POST" && path.startsWith("/runtime/admin/tenants/") && path.endsWith("/credentials")) {

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
        path
          .replace("/runtime/admin/tenants/", "")
          .replace("/credentials", "")
      );

      const body = await readBody(req);

      const username = body.username;
      const password = body.password;
      const status = body.status || "active";
      const scope = body.scope || "tenant";
      const system_role = body.system_role || null;

      if (!tenant_id || !username || !password) {
        return send(res, 400, {
          error: "missing_required_credential_fields",
          required: [
            "tenant_id",
            "username",
            "password"
          ]
        });
      }

      const memberResult = await db.query(`
        SELECT member_id, role, status
        FROM runtime_tenant_members
        WHERE tenant_id = $1
          AND username = $2
        LIMIT 1
      `, [
        tenant_id,
        username
      ]);

      if (memberResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_member_not_found",
          tenant_id,
          username
        });
      }

      const existingResult = await db.query(`
        SELECT credential_id
        FROM runtime_operator_credentials
        WHERE tenant_id = $1
          AND username = $2
        LIMIT 1
      `, [
        tenant_id,
        username
      ]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "credential_already_exists",
          tenant_id,
          username
        });
      }

      const credential_id =
        "cred-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "system_admin";

      const insertResult = await db.query(`
        INSERT INTO runtime_operator_credentials (
          credential_id,
          tenant_id,
          username,
          password,
          status,
          created_by,
          scope,
          system_role
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        RETURNING
          credential_id,
          tenant_id,
          username,
          status,
          created_by,
          created_at,
          scope,
          system_role
      `, [
        credential_id,
        tenant_id,
        username,
        password,
        status,
        created_by,
        scope,
        system_role
      ]);

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.admin.tenant_credential.created",
        message: "Tenant credential created: " + username
      });

      return send(res, 200, {
        created: true,
        credential: insertResult.rows[0]
      });
    }

    // RSOS-050B Global Tenant Control API - Tenant List
    if (req.method === "GET" && path === "/runtime/admin/tenants") {

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

      const result = await db.query(`
        SELECT
          t.tenant_id,
          t.tenant_name,
          t.tenant_type,
          t.status,
          t.owner_name,
          t.owner_email,
          t.created_at,

          COALESCE(d.domains, 0)::int AS domains,
          COALESCE(m.members, 0)::int AS members,
          COALESCE(c.credentials, 0)::int AS credentials,
          COALESCE(o.objects, 0)::int AS objects,
          COALESCE(r.recommendations, 0)::int AS recommendations,
          COALESCE(tp.training_plans, 0)::int AS training_plans

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
          SELECT tenant_id, COUNT(*) AS credentials
          FROM runtime_operator_credentials
          GROUP BY tenant_id
        ) c ON c.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS objects
          FROM runtime_objects
          GROUP BY tenant_id
        ) o ON o.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS recommendations
          FROM runtime_recommendations
          GROUP BY tenant_id
        ) r ON r.tenant_id = t.tenant_id

        LEFT JOIN (
          SELECT tenant_id, COUNT(*) AS training_plans
          FROM runtime_training_plans
          GROUP BY tenant_id
        ) tp ON tp.tenant_id = t.tenant_id

        ORDER BY t.tenant_name ASC
      `);

      return send(res, 200, {
        scope: "global",
        tenant_count: result.rows.length,
        tenants: result.rows
      });
    }


  return false;
}

module.exports = {
  handleTenantAdminRoute
};
