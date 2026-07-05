async function handleDefenseRecoveryRequestsCoreRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path === "/runtime/defense/recovery-requests") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "operator"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const body = await readBody(req);
    const tenant_id = body.tenant_id || auth.user.tenant_id;
    const actor_id = auth.user.username || auth.user.operator_id || "system";

    const result = await db.query(`
      INSERT INTO runtime_recovery_requests (
        tenant_id,
        quarantine_id,
        savepoint_id,
        request_type,
        request_reason,
        requested_by
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [
      tenant_id,
      body.quarantine_id || null,
      body.savepoint_id || null,
      body.request_type || "rollback",
      body.request_reason || "runtime recovery requested",
      actor_id
    ]);

    const recovery_request = result.rows[0];

    await writeEvent({
      event_type: "runtime.recovery.request.created",
      object_id: body.savepoint_id || body.quarantine_id || null,
      message: `Recovery request created: ${recovery_request.recovery_request_id}`,
      tenant_id
    });

    return send(res, 201, {
      recovery_request
    });
  }

  if (req.method === "GET" && path === "/runtime/defense/recovery-requests") {
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
      FROM runtime_recovery_requests
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [
      tenant_id
    ]);

    return send(res, 200, {
      recovery_requests: result.rows
    });
  }

  return false;
}

module.exports = {
  handleDefenseRecoveryRequestsCoreRoute
};
