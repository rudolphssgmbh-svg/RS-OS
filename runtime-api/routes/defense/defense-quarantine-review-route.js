async function handleDefenseQuarantineReviewRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path.startsWith("/runtime/defense/quarantine/") && path.endsWith("/review")) {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin",
      "operator"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const quarantine_id = path
      .replace("/runtime/defense/quarantine/", "")
      .replace("/review", "");

    const body = await readBody(req);
    const tenant_id = auth.user.tenant_id;

    const result = await db.query(`
      UPDATE runtime_quarantine_queue
      SET
        status = 'under_review',
        assigned_to = COALESCE($3, assigned_to),
        reviewed_by = $4,
        reviewed_at = now(),
        review_comment = $5,
        updated_at = now()
      WHERE quarantine_id = $1
        AND tenant_id = $2
      RETURNING *
    `, [
      quarantine_id,
      tenant_id,
      body.assigned_to || null,
      auth.user.username || auth.user.operator_id || "system",
      body.review_comment || "review_started"
    ]);

    if (result.rows.length === 0) {
      return send(res, 404, {
        error: "not_found",
        message: "quarantine item not found"
      });
    }

    const quarantine = result.rows[0];

    await writeEvent({
      event_type: "runtime.defense.quarantine.review_started",
      object_id: quarantine.object_id,
      message: `Quarantine review started: ${quarantine.quarantine_id}`,
      tenant_id
    });

    return send(res, 200, {
      quarantine
    });
  }

  return false;
}

module.exports = {
  handleDefenseQuarantineReviewRoute
};
