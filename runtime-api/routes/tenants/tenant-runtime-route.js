async function handleTenantRuntimeRoute({
  req,
  res,
  path,
  db,
  requireRole,
  readBody,
  writeEvent,
  send
}) {
    // CREATE RUNTIME TENANT

    if (req.method === "POST" && path === "/runtime/tenants") {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const body = await readBody(req);

      const tenant_id = body.tenant_id;
      const tenant_name = body.tenant_name;
      const tenant_type = body.tenant_type || "business";
      const status = body.status || "active";
      const owner_name = body.owner_name || null;
      const owner_email = body.owner_email || null;

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
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const existingResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (existingResult.rows.length > 0) {
        return send(res, 409, {
          error: "tenant_already_exists",
          tenant_id
        });
      }

      const insertResult = await db.query(`
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

      const tenant = insertResult.rows[0];

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant.tenant_id,
        event_type: "runtime.tenant.created",
        message: `Tenant created: ${tenant.tenant_name}`
      });

      return send(res, 200, {
        created: true,
        tenant
      });
    }


    // CREATE RUNTIME TENANT DOMAIN

    if (req.method === "POST" && path.startsWith("/runtime/tenants/") && path.endsWith("/domains")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/domains", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const body = await readBody(req);

      const domain_name = body.domain_name;
      const domain_role = body.domain_role || "primary";
      const status = body.status || "active";

      if (!domain_name) {
        return send(res, 400, {
          error: "missing_domain_name"
        });
      }

      const tenantResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const existingDomainResult = await db.query(`
        SELECT domain_id, tenant_id, domain_name
        FROM runtime_tenant_domains
        WHERE domain_name = $1
        LIMIT 1
      `, [
        domain_name
      ]);

      if (existingDomainResult.rows.length > 0) {
        return send(res, 409, {
          error: "domain_already_exists",
          domain: existingDomainResult.rows[0]
        });
      }

      const domain_id =
        "dom-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const insertResult = await db.query(`
        INSERT INTO runtime_tenant_domains (
          domain_id,
          tenant_id,
          domain_name,
          domain_role,
          status,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING *
      `, [
        domain_id,
        tenant_id,
        domain_name,
        domain_role,
        status,
        created_by
      ]);

      const domain = insertResult.rows[0];

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.tenant.domain.created",
        message: `Tenant domain created: ${domain.domain_name}`
      });

      return send(res, 200, {
        created: true,
        domain
      });
    }


    // UPSERT RUNTIME TENANT SETTING

    if (req.method === "POST" && path.startsWith("/runtime/tenants/") && path.endsWith("/settings")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/settings", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const body = await readBody(req);

      const setting_key = body.setting_key;
      const setting_value = body.setting_value || {};

      if (!setting_key) {
        return send(res, 400, {
          error: "missing_setting_key"
        });
      }

      const tenantResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const actor =
        auth.user.operator_id || auth.user.username || "runtime_admin";

      const setting_id =
        "set-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const result = await db.query(`
        INSERT INTO runtime_tenant_settings (
          setting_id,
          tenant_id,
          setting_key,
          setting_value,
          created_by
        )
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (tenant_id, setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_by = $5,
          updated_at = now()
        RETURNING *
      `, [
        setting_id,
        tenant_id,
        setting_key,
        JSON.stringify(setting_value),
        actor
      ]);

      const setting = result.rows[0];

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.tenant.setting.upserted",
        message: `Tenant setting upserted: ${setting.setting_key}`
      });

      return send(res, 200, {
        upserted: true,
        setting
      });
    }


    // GET RUNTIME TENANT SETTINGS

    if (req.method === "GET" && path.startsWith("/runtime/tenants/") && path.endsWith("/settings")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/settings", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const result = await db.query(`
        SELECT
          setting_id,
          tenant_id,
          setting_key,
          setting_value,
          created_by,
          created_at,
          updated_by,
          updated_at
        FROM runtime_tenant_settings
        WHERE tenant_id = $1
        ORDER BY setting_key ASC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant_id,
        setting_count: result.rows.length,
        settings: result.rows
      });
    }


    // CREATE RUNTIME TENANT MEMBER

    if (req.method === "POST" && path.startsWith("/runtime/tenants/") && path.endsWith("/members")) {

      const auth = requireRole(req, [
        "runtime_admin",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/members", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const body = await readBody(req);

      const username = body.username;
      const display_name = body.display_name || null;
      const email = body.email || null;
      const role = body.role || "tenant_user";
      const status = body.status || "active";

      if (!username) {
        return send(res, 400, {
          error: "missing_username"
        });
      }

      const tenantResult = await db.query(`
        SELECT tenant_id
        FROM runtime_tenants
        WHERE tenant_id = $1
        LIMIT 1
      `, [
        tenant_id
      ]);

      if (tenantResult.rows.length === 0) {
        return send(res, 404, {
          error: "tenant_not_found",
          tenant_id
        });
      }

      const existingResult = await db.query(`
        SELECT member_id, tenant_id, username
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
          member: existingResult.rows[0]
        });
      }

      const member_id =
        "mem-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

      const created_by =
        auth.user.operator_id || auth.user.username || "runtime_admin";

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

      const member = insertResult.rows[0];

      await writeEvent({
        tenant_id: auth.user.tenant_id,
        object_id: tenant_id,
        event_type: "runtime.tenant.member.created",
        message: `Tenant member created: ${member.username}`
      });

      return send(res, 200, {
        created: true,
        member
      });
    }


    // GET RUNTIME TENANT MEMBERS

    if (req.method === "GET" && path.startsWith("/runtime/tenants/") && path.endsWith("/members")) {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenant_id = decodeURIComponent(
        path
          .replace("/runtime/tenants/", "")
          .replace("/members", "")
      );

      if (!tenant_id) {
        return send(res, 400, {
          error: "missing_tenant_id"
        });
      }

      const result = await db.query(`
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
        ORDER BY created_at DESC
      `, [
        tenant_id
      ]);

      return send(res, 200, {
        tenant_id,
        member_count: result.rows.length,
        members: result.rows
      });
    }

    // GET RUNTIME TENANTS


  return false;
}

module.exports = {
  handleTenantRuntimeRoute
};
