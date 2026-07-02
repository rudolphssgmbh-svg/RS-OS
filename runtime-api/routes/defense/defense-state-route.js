async function handleDefenseStateRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "GET" && path === "/runtime/defense/state") {
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
      FROM runtime_defense_state
      WHERE tenant_id = $1
      ORDER BY updated_at DESC
      LIMIT 100
    `, [tenant_id]);

    return send(res, 200, {
      defense_state: result.rows
    });
  }

  if (req.method === "POST" && path === "/runtime/defense/state") {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const body = await readBody(req);
    const tenant_id = body.tenant_id || auth.user.tenant_id;

    const result = await db.query(`
      INSERT INTO runtime_defense_state (
        tenant_id,
        scope_type,
        scope_id,
        defense_mode,
        defense_level,
        current_risk_score,
        current_confidence_score,
        active_policy_flags,
        active_risk_flags,
        state_reason,
        updated_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      ON CONFLICT (tenant_id, scope_type, scope_id)
      DO UPDATE SET
        defense_mode = EXCLUDED.defense_mode,
        defense_level = EXCLUDED.defense_level,
        current_risk_score = EXCLUDED.current_risk_score,
        current_confidence_score = EXCLUDED.current_confidence_score,
        active_policy_flags = EXCLUDED.active_policy_flags,
        active_risk_flags = EXCLUDED.active_risk_flags,
        state_reason = EXCLUDED.state_reason,
        updated_by = EXCLUDED.updated_by,
        updated_at = now()
      RETURNING *
    `, [
      tenant_id,
      body.scope_type || "tenant",
      body.scope_id || tenant_id,
      body.defense_mode || "normal",
      body.defense_level || "standard",
      body.current_risk_score || null,
      body.current_confidence_score || null,
      JSON.stringify(body.active_policy_flags || []),
      JSON.stringify(body.active_risk_flags || []),
      body.state_reason || "manual_defense_state_update",
      auth.user.username || "system"
    ]);

    const defense_state = result.rows[0];

    await writeEvent({
      event_type: "runtime.defense.state.updated",
      object_id: null,
      message: `Defense state updated: ${defense_state.scope_type}/${defense_state.scope_id}`,
      tenant_id
    });

    return send(res, 200, {
      defense_state
    });
  }

  return false;
}

module.exports = {
  handleDefenseStateRoute
};
