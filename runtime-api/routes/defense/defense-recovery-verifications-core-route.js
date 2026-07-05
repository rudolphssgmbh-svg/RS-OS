async function handleDefenseRecoveryVerificationsCoreRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path === "/runtime/defense/recovery-verifications") {
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

    const recoveryResult = await db.query(`
      SELECT *
      FROM runtime_recovery_requests
      WHERE recovery_request_id = $1
        AND tenant_id = $2
      LIMIT 1
    `, [
      body.recovery_request_id,
      tenant_id
    ]);

    if (recoveryResult.rows.length === 0) {
      return send(res, 404, {
        error: "not_found",
        message: "recovery request not found"
      });
    }

    const recovery_request = recoveryResult.rows[0];

    if (recovery_request.execution_status !== "completed") {
      return send(res, 409, {
        error: "recovery_not_completed",
        message: `execution_status is ${recovery_request.execution_status}`,
        recovery_request
      });
    }

    const verification_status =
      body.verification_status || "verified";

    const closure_status =
      verification_status === "verified"
        ? "ready_to_close"
        : "pending";

    const result = await db.query(`
      INSERT INTO runtime_recovery_verifications (
        tenant_id,
        recovery_request_id,
        savepoint_id,
        verification_status,
        verification_result,
        verified_by,
        closure_status,
        notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `, [
      tenant_id,
      body.recovery_request_id,
      recovery_request.savepoint_id,
      verification_status,
      JSON.stringify(body.verification_result || {}),
      actor_id,
      closure_status,
      body.notes || null
    ]);

    const verification = result.rows[0];

    await db.query(`
      UPDATE runtime_recovery_requests
      SET
        verification_status = $3,
        updated_at = now()
      WHERE recovery_request_id = $1
        AND tenant_id = $2
    `, [
      body.recovery_request_id,
      tenant_id,
      verification_status
    ]);

    await writeEvent({
      event_type: "runtime.recovery.verification.created",
      object_id: recovery_request.savepoint_id,
      message: `Recovery verification created: ${verification.verification_id}`,
      tenant_id
    });

    return send(res, 201, {
      verification
    });
  }

  if (req.method === "GET" && path === "/runtime/defense/recovery-verifications") {
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
      FROM runtime_recovery_verifications
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [
      tenant_id
    ]);

    return send(res, 200, {
      recovery_verifications: result.rows
    });
  }

  return false;
}

module.exports = {
  handleDefenseRecoveryVerificationsCoreRoute
};
