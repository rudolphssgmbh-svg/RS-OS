async function handleDefenseRecoveryVerificationsCloseRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-verifications/") && path.endsWith("/close")) {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const verification_id = path
      .replace("/runtime/defense/recovery-verifications/", "")
      .replace("/close", "");

    const body = await readBody(req);
    const tenant_id = auth.user.tenant_id;
    const actor_id = auth.user.username || auth.user.operator_id || "system";

    const result = await db.query(`
      UPDATE runtime_recovery_verifications
      SET
        closure_status = 'closed',
        notes = COALESCE($3, notes)
      WHERE verification_id = $1
        AND tenant_id = $2
        AND verification_status = 'verified'
      RETURNING *
    `, [
      verification_id,
      tenant_id,
      body.notes || null
    ]);

    if (result.rows.length === 0) {
      return send(res, 409, {
        error: "closure_not_allowed",
        message: "verification not found or verification_status is not verified"
      });
    }

    const verification = result.rows[0];

    await db.query(`
      UPDATE runtime_recovery_requests
      SET
        verification_status = 'closed',
        updated_at = now()
      WHERE recovery_request_id = $1
        AND tenant_id = $2
    `, [
      verification.recovery_request_id,
      tenant_id
    ]);

    await db.query(`
      UPDATE runtime_defense_state
      SET
        state_reason = $2,
        updated_by = $3,
        updated_at = now()
      WHERE tenant_id = $1
    `, [
      tenant_id,
      body.notes || "recovery verified and closed",
      actor_id
    ]);

    await writeEvent({
      event_type: "runtime.recovery.verification.closed",
      object_id: verification.savepoint_id,
      message: `Recovery verification closed: ${verification.verification_id}`,
      tenant_id
    });

    return send(res, 200, {
      verification
    });
  }

  return false;
}

module.exports = {
  handleDefenseRecoveryVerificationsCloseRoute
};
