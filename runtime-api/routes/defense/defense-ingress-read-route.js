async function handleDefenseIngressReadRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method === "GET" && path === "/runtime/defense/ingress") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "operator",
      "auditor"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const tenant_id = auth.user.tenant_id;

    const result = await db.query(`
      SELECT *
      FROM runtime_ingress_events
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [tenant_id]);

    return send(res, 200, {
      ingress_events: result.rows
    });
  }

  return false;
}

module.exports = {
  handleDefenseIngressReadRoute
};
