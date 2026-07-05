async function handleDefenseQuarantineRejectRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path.startsWith("/runtime/defense/quarantine/") && path.endsWith("/reject")) {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const quarantine_id = path
      .replace("/runtime/defense/quarantine/", "")
      .replace("/reject", "");

    const body = await readBody(req);
    const tenant_id = auth.user.tenant_id;

    const result = await db.query(`
      UPDATE runtime_quarantine_queue
      SET
        status = 'rejected',
        reviewed_by = $3,
        reviewed_at = now(),
        review_decision = 'rejected',
        review_comment = $4,
        updated_at = now()
      WHERE quarantine_id = $1
        AND tenant_id = $2
      RETURNING *
    `, [
      quarantine_id,
      tenant_id,
      auth.user.username || auth.user.operator_id || "system",
      body.review_comment || "rejected by runtime defense review"
    ]);

    if (result.rows.length === 0) {
      return send(res, 404, {
        error: "not_found",
        message: "quarantine item not found"
      });
    }

    const quarantine = result.rows[0];

    await writeEvent({
      event_type: "runtime.defense.quarantine.rejected",
      object_id: quarantine.object_id,
      message: `Quarantine rejected: ${quarantine.quarantine_id}`,
      tenant_id
    });

    await db.query(`
      UPDATE runtime_ingress_events
      SET
        defense_status = 'rejected',
        defense_decision = 'reject_after_review'
      WHERE ingress_id = $1
        AND tenant_id = $2
    `, [
      quarantine.ingress_id,
      tenant_id
    ]);

    await db.query(`
      UPDATE runtime_defense_state
      SET
        open_quarantine_count = (
          SELECT COUNT(*)
          FROM runtime_quarantine_queue
          WHERE tenant_id = $1
            AND status = 'open'
        ),
        recent_rejection_count = recent_rejection_count + 1,
        state_reason = 'quarantine rejected',
        updated_by = $2,
        updated_at = now()
      WHERE tenant_id = $1
    `, [
      tenant_id,
      auth.user.username || auth.user.operator_id || "system"
    ]);

    return send(res, 200, {
      quarantine
    });
  }

  return false;
}

module.exports = {
  handleDefenseQuarantineRejectRoute
};
