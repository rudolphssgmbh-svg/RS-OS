async function handleDefenseQuarantineCoreRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path === "/runtime/defense/quarantine") {
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

    const result = await db.query(`
      INSERT INTO runtime_quarantine_queue (
        tenant_id,
        ingress_id,
        quarantine_reason,
        severity,
        category,
        object_id,
        runtime_type,
        proposed_action,
        proposed_payload,
        detected_by,
        detection_details,
        required_approval_level
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12
      )
      RETURNING *
    `, [
      tenant_id,
      body.ingress_id,
      body.quarantine_reason || "defense_review_required",
      body.severity || "medium",
      body.category || "runtime_defense",
      body.object_id || null,
      body.object_type || null,
      body.proposed_action || "unknown",
      JSON.stringify(body.proposed_payload || {}),
      body.detected_by || "runtime_defense_layer",
      JSON.stringify(body.detection_details || {}),
      body.required_approval_level || "runtime_admin"
    ]);

    const quarantine = result.rows[0];

    await writeEvent({
      event_type: "runtime.defense.quarantine.created",
      object_id: quarantine.object_id,
      message: `Quarantine item created: ${quarantine.quarantine_id}`,
      tenant_id
    });

    return send(res, 201, {
      quarantine
    });
  }

  if (req.method === "GET" && path === "/runtime/defense/quarantine") {
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
      FROM runtime_quarantine_queue
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [tenant_id]);

    return send(res, 200, {
      quarantine_queue: result.rows
    });
  }

  return false;
}

module.exports = {
  handleDefenseQuarantineCoreRoute
};
