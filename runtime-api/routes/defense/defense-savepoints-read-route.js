async function handleDefenseSavepointsReadRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole
}) {
  if (req.method === "GET" && path === "/runtime/defense/savepoints") {
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
      FROM runtime_savepoints
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [tenant_id]);

    return send(res, 200, {
      savepoints: result.rows
    });
  }

  return false;
}

module.exports = {
  handleDefenseSavepointsReadRoute
};
