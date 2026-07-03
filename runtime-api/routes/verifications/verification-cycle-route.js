async function handleVerificationCycleRoute({
  req,
  res,
  path,
  db,
  verifyToken,
  readBody,
  writeEvent,
  send
}) {
  if (req.method === "POST" && path === "/runtime/verification-cycles") {
    const authUser = verifyToken(req);
    if (!authUser) return send(res, 401, { error: "unauthorized", message: "JWT token required" });

    const body = await readBody(req);

    const tenant_id = authUser.tenant_id;
    const outcome_id = body.outcome_id || null;
    const measurement_id = body.measurement_id || null;
    const hypothesis_id = body.hypothesis_id || null;
    const assumption_id = body.assumption_id || null;
    const fact_id = body.fact_id || null;
    const verification_type = body.verification_type;
    const verification_status = body.verification_status || "pending";
    const expected_value = body.expected_value || null;
    const observed_value = body.observed_value || null;
    const verification_result = body.verification_result || null;
    const confidence_before = body.confidence_before === undefined ? null : body.confidence_before;
    const confidence_after = body.confidence_after === undefined ? null : body.confidence_after;
    const verified_at = body.verified_at || null;
    const created_by = authUser.operator_id || authUser.role || "runtime_user";

    if (!tenant_id || !verification_type) {
      return send(res, 400, {
        error: "validation_error",
        message: "tenant_id and verification_type required"
      });
    }

    const result = await db.query(`
      INSERT INTO runtime_verification_cycles (
        tenant_id,
        outcome_id,
        measurement_id,
        hypothesis_id,
        assumption_id,
        fact_id,
        verification_type,
        verification_status,
        expected_value,
        observed_value,
        verification_result,
        confidence_before,
        confidence_after,
        verified_at,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,COALESCE($14::timestamptz, NULL),$15)
      RETURNING *
    `, [
      tenant_id,
      outcome_id,
      measurement_id,
      hypothesis_id,
      assumption_id,
      fact_id,
      verification_type,
      verification_status,
      expected_value,
      observed_value,
      verification_result,
      confidence_before,
      confidence_after,
      verified_at,
      created_by
    ]);

    await writeEvent({
      tenant_id,
      object_id: result.rows[0].verification_id,
      event_type: "runtime.verification_cycle.created",
      message: JSON.stringify({
        verification_id: result.rows[0].verification_id,
        outcome_id,
        measurement_id,
        verification_type,
        verification_status,
        verification_result
      })
    });

    return send(res, 201, { verification_cycle: result.rows[0] });
  }

  if (req.method === "GET" && path === "/runtime/verification-cycles") {
    const authUser = verifyToken(req);
    if (!authUser) return send(res, 401, { error: "unauthorized", message: "JWT token required" });

    const urlObj = new URL(req.url, "http://localhost");
    const tenant_id = authUser.tenant_id;
    const outcome_id = urlObj.searchParams.get("outcome_id");
    const measurement_id = urlObj.searchParams.get("measurement_id");

    let query = `
      SELECT *
      FROM runtime_verification_cycles
      WHERE tenant_id = $1
    `;
    const params = [tenant_id];

    if (outcome_id) {
      params.push(outcome_id);
      query += " AND outcome_id = $" + params.length;
    }

    if (measurement_id) {
      params.push(measurement_id);
      query += " AND measurement_id = $" + params.length;
    }

    query += " ORDER BY created_at DESC LIMIT 100";

    const result = await db.query(query, params);

    return send(res, 200, { verification_cycles: result.rows });
  }

  return false;
}

module.exports = {
  handleVerificationCycleRoute
};
