async function handleListRuntimeObjectsRoute({
  req,
  res,
  db,
  send,
  requireRole
}) {
  const auth = requireRole(req, [
    "runtime_admin",
    "auditor"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const result = await db.query(`
    SELECT *
    FROM runtime_objects
    WHERE tenant_id = $1
    ORDER BY created_at DESC
  `, [auth.user.tenant_id]);

  return send(res, 200, {
    count: result.rows.length,
    objects: result.rows
  });
}

module.exports = { handleListRuntimeObjectsRoute };
