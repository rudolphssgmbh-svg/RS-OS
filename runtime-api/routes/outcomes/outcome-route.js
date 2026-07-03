async function handleOutcomeRoute({
  req,
  res,
  path,
  db,
  verifyToken,
  readBody,
  writeEvent,
  send
}) {
  if (req.method === "POST" && path === "/runtime/outcomes") {
    const authUser = verifyToken(req);
    if (!authUser) return send(res, 401, { error: "unauthorized", message: "JWT token required" });

    const body = await readBody(req);

    const tenant_id = authUser.tenant_id;
    const object_id = body.object_id || null;
    const action_id = body.action_id || null;
    const outcome_type = body.outcome_type;
    const outcome_title = body.outcome_title;
    const outcome_description = body.outcome_description || null;
    const expected_result = body.expected_result || null;
    const actual_result = body.actual_result || null;
    const outcome_status = body.outcome_status || "observed";
    const observed_at = body.observed_at || null;
    const created_by = authUser.operator_id || authUser.role || "runtime_user";

    if (!tenant_id || !outcome_type || !outcome_title) {
      return send(res, 400, {
        error: "validation_error",
        message: "tenant_id, outcome_type and outcome_title required"
      });
    }

    const result = await db.query(`
      INSERT INTO runtime_outcomes (
        tenant_id, object_id, action_id, outcome_type, outcome_title,
        outcome_description, expected_result, actual_result,
        outcome_status, observed_at, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::timestamptz, now()),$11)
      RETURNING *
    `, [
      tenant_id, object_id, action_id, outcome_type, outcome_title,
      outcome_description, expected_result, actual_result,
      outcome_status, observed_at, created_by
    ]);

    await writeEvent({
      tenant_id,
      object_id: result.rows[0].outcome_id,
      event_type: "runtime.outcome.created",
      message: JSON.stringify({
        outcome_id: result.rows[0].outcome_id,
        outcome_type,
        outcome_title
      })
    });

    return send(res, 201, { outcome: result.rows[0] });
  }

  if (req.method === "GET" && path === "/runtime/outcomes") {
    const authUser = verifyToken(req);
    if (!authUser) return send(res, 401, { error: "unauthorized", message: "JWT token required" });

    const tenant_id = authUser.tenant_id;

    const result = await db.query(`
      SELECT *
      FROM runtime_outcomes
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `, [tenant_id]);

    return send(res, 200, { outcomes: result.rows });
  }

  return false;
}

module.exports = {
  handleOutcomeRoute
};
