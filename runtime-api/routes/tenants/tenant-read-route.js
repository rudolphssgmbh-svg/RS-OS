async function handleTenantReadRoute({
  req,
  res,
  path,
  db,
  requireRole,
  send
}) {
    if (req.method === "GET" && path === "/runtime/tenants") {

      const auth = requireRole(req, [
        "system_admin",
        "runtime_admin",
        "auditor",
        "governance"
      ]);

      if (!auth.allowed) {
        return send(res, auth.code, auth.response);
      }

      const tenantsResult = await db.query(`
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
        ORDER BY created_at DESC
      `);

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
        ORDER BY created_at DESC
      `);

      return send(res, 200, {
        tenant_count: tenantsResult.rows.length,
        tenants: tenantsResult.rows,
        domain_count: domainsResult.rows.length,
        domains: domainsResult.rows
      });
    }


    // GET RUNTIME TENANT BY ID

    if (req.method === "GET" && path.startsWith("/runtime/tenants/")) {

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
        path.replace("/runtime/tenants/", "")
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
      `, [
        tenant_id
      ]);

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
        ORDER BY created_at DESC
      `, [
        tenant_id
      ]);

      const settingsResult = await db.query(`
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
        tenant: tenantResult.rows[0],
        domains: {
          count: domainsResult.rows.length,
          items: domainsResult.rows
        },
        settings: {
          count: settingsResult.rows.length,
          items: settingsResult.rows
        }
      });
    }


  return false;
}

module.exports = {
  handleTenantReadRoute
};
