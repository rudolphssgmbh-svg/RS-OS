async function handleMeasurementRoute({
  req,
  res,
  path,
  db,
  verifyToken,
  readBody,
  writeEvent,
  send
}) {
  if (req.method === "POST" && path === "/runtime/measurements") {
    const authUser = verifyToken(req);
    if (!authUser) return send(res, 401, { error: "unauthorized", message: "JWT token required" });

    const body = await readBody(req);

    const tenant_id = authUser.tenant_id;
    const outcome_id = body.outcome_id || null;
    const metric_name = body.metric_name;
    const metric_value = body.metric_value === undefined ? null : body.metric_value;
    const metric_unit = body.metric_unit || null;
    const target_value = body.target_value === undefined ? null : body.target_value;
    const variance_value = body.variance_value === undefined ? null : body.variance_value;
    const measurement_time = body.measurement_time || null;
    const created_by = authUser.operator_id || authUser.role || "runtime_user";

    if (!tenant_id || !metric_name) {
      return send(res, 400, {
        error: "validation_error",
        message: "tenant_id and metric_name required"
      });
    }

    const result = await db.query(`
      INSERT INTO runtime_measurements (
        tenant_id, outcome_id, metric_name, metric_value, metric_unit,
        target_value, variance_value, measurement_time, created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz, now()),$9)
      RETURNING *
    `, [
      tenant_id, outcome_id, metric_name, metric_value, metric_unit,
      target_value, variance_value, measurement_time, created_by
    ]);

    await writeEvent({
      tenant_id,
      object_id: result.rows[0].measurement_id,
      event_type: "runtime.measurement.created",
      message: JSON.stringify({
        measurement_id: result.rows[0].measurement_id,
        outcome_id,
        metric_name,
        metric_value,
        metric_unit
      })
    });

    const autoCycle = await db.query(`
      INSERT INTO runtime_verification_cycles (
        tenant_id,
        measurement_id,
        verification_type,
        verification_status,
        expected_value,
        observed_value,
        verification_result,
        confidence_before,
        confidence_after,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      tenant_id,
      result.rows[0].measurement_id,
      "measurement_auto_verification",
      "pending",
      "Measurement requires verification",
      "Measurement created",
      "awaiting verification",
      50,
      50,
      created_by
    ]);

    await db.query(`
      INSERT INTO runtime_verification_checks (
        tenant_id,
        measurement_id,
        verification_cycle_id,
        check_type,
        check_status,
        expected_value,
        observed_value,
        check_notes,
        checked_at,
        checked_by,
        created_by
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),$9,$9)
    `, [
      tenant_id,
      result.rows[0].measurement_id,
      autoCycle.rows[0].verification_id,
      "measurement_created",
      "pending",
      "Measurement should be verified",
      "Measurement created",
      "Automatic RSOS-060H trigger",
      created_by
    ]);

    await writeEvent({
      tenant_id,
      object_id: result.rows[0].measurement_id,
      event_type: "runtime.verification.cycle.auto_created",
      message: JSON.stringify({
        measurement_id: result.rows[0].measurement_id,
        verification_id: autoCycle.rows[0].verification_id,
        verification_type: "measurement_auto_verification",
        verification_status: "pending"
      })
    });

    await writeEvent({
      tenant_id,
      object_id: result.rows[0].measurement_id,
      event_type: "runtime.verification.check.auto_created",
      message: JSON.stringify({
        measurement_id: result.rows[0].measurement_id,
        verification_id: autoCycle.rows[0].verification_id,
        check_type: "measurement_created",
        check_status: "pending"
      })
    });

    return send(res, 201, { measurement: result.rows[0] });
  }

  if (req.method === "GET" && path === "/runtime/measurements") {
    const authUser = verifyToken(req);
    if (!authUser) return send(res, 401, { error: "unauthorized", message: "JWT token required" });

    const urlObj = new URL(req.url, "http://localhost");
    const tenant_id = authUser.tenant_id;
    const outcome_id = urlObj.searchParams.get("outcome_id");

    let query = `
      SELECT *
      FROM runtime_measurements
      WHERE tenant_id = $1
    `;
    const params = [tenant_id];

    if (outcome_id) {
      params.push(outcome_id);
      query += " AND outcome_id = $" + params.length;
    }

    query += " ORDER BY created_at DESC LIMIT 100";

    const result = await db.query(query, params);

    return send(res, 200, { measurements: result.rows });
  }

  return false;
}

module.exports = {
  handleMeasurementRoute
};
