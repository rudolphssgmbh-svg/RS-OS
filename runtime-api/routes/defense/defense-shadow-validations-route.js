async function handleDefenseShadowValidationsRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path === "/runtime/defense/shadow-validations") {
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
      INSERT INTO runtime_shadow_validations (
        tenant_id,
        ingress_id,
        object_id,
        runtime_type,
        proposed_action,
        current_state,
        proposed_state,
        validation_scope,
        validation_engine,
        validation_status,
        validation_decision,
        risk_score,
        confidence_score,
        findings,
        required_actions,
        completed_at
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,
        'passed_with_warnings',
        'requires_human_review',
        $10,$11,$12,$13,now()
      )
      RETURNING *
    `, [
      tenant_id,
      body.ingress_id,
      body.object_id || null,
      body.object_type || null,
      body.proposed_action || "unknown",
      JSON.stringify(body.current_state || {}),
      JSON.stringify(body.proposed_state || {}),
      body.validation_scope || "runtime_write",
      body.validation_engine || "rsos-defense-shadow-v1",
      body.risk_score || 20,
      body.confidence_score || 75,
      JSON.stringify(body.findings || []),
      JSON.stringify(body.required_actions || [])
    ]);

    const validation = result.rows[0];

    await writeEvent({
      event_type: "runtime.defense.shadow_validation.completed",
      object_id: validation.object_id,
      message: `Shadow validation completed: ${validation.shadow_validation_id}`,
      tenant_id
    });

    return send(res, 201, {
      shadow_validation: validation
    });
  }

  if (req.method === "GET" && path === "/runtime/defense/shadow-validations") {
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
      FROM runtime_shadow_validations
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [tenant_id]);

    return send(res, 200, {
      shadow_validations: result.rows
    });
  }

  return false;
}

module.exports = {
  handleDefenseShadowValidationsRoute
};
