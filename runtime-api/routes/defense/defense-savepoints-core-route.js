async function handleDefenseSavepointsCoreRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path === "/runtime/defense/savepoints") {
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
    const previous_state = body.previous_state || {};
    const previous_state_hash = require("crypto")
      .createHash("sha256")
      .update(JSON.stringify(previous_state))
      .digest("hex");

    const result = await db.query(`
      INSERT INTO runtime_savepoints (
        tenant_id,
        object_id,
        runtime_type,
        created_for_ingress_id,
        created_for_action,
        previous_state,
        previous_state_hash,
        savepoint_reason,
        criticality
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9
      )
      RETURNING *
    `, [
      tenant_id,
      body.object_id,
      body.runtime_type,
      body.created_for_ingress_id || null,
      body.created_for_action || "runtime_change",
      JSON.stringify(previous_state),
      previous_state_hash,
      body.savepoint_reason || "pre_change_defense_savepoint",
      body.criticality || "medium"
    ]);

    const savepoint = result.rows[0];

    await writeEvent({
      event_type: "runtime.defense.savepoint.created",
      object_id: savepoint.object_id,
      message: `Defense savepoint created: ${savepoint.savepoint_id}`,
      tenant_id
    });

    return send(res, 201, {
      savepoint
    });
  }

  return false;
}

module.exports = {
  handleDefenseSavepointsCoreRoute
};
