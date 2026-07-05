async function handleDefenseRecoveryRequestsReviewRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/review")) {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "operator"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const recovery_request_id = path
      .replace("/runtime/defense/recovery-requests/", "")
      .replace("/review", "");

    const body = await readBody(req);
    const tenant_id = auth.user.tenant_id;
    const actor_id = auth.user.username || auth.user.operator_id || "system";

    const result = await db.query(`
      UPDATE runtime_recovery_requests
      SET
        review_status = 'under_review',
        reviewed_by = $3,
        reviewed_at = now(),
        review_comment = $4,
        updated_at = now()
      WHERE recovery_request_id = $1
        AND tenant_id = $2
      RETURNING *
    `, [
      recovery_request_id,
      tenant_id,
      actor_id,
      body.review_comment || "recovery review started"
    ]);

    if (result.rows.length === 0) {
      return send(res, 404, {
        error: "not_found",
        message: "recovery request not found"
      });
    }

    const recovery_request = result.rows[0];

    await writeEvent({
      event_type: "runtime.recovery.request.review_started",
      object_id: recovery_request.savepoint_id || recovery_request.quarantine_id,
      message: `Recovery request review started: ${recovery_request.recovery_request_id}`,
      tenant_id
    });

    return send(res, 200, {
      recovery_request
    });
  }

  return false;
}

module.exports = {
  handleDefenseRecoveryRequestsReviewRoute
};
