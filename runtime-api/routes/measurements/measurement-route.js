const { createRuntimeMeasurementWriteService } = require("../../src/services/runtime-measurement-write-service");

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

    if (!authUser) {
      return send(res, 401, {
        error: "unauthorized",
        message: "JWT token required"
      });
    }

    const body = await readBody(req);

    const tenant_id = authUser.tenant_id;
    const outcome_id = body.outcome_id || null;
    const metric_name = body.metric_name;
    const metric_value =
      body.metric_value === undefined
        ? null
        : body.metric_value;
    const metric_unit = body.metric_unit || null;
    const target_value =
      body.target_value === undefined
        ? null
        : body.target_value;
    const variance_value =
      body.variance_value === undefined
        ? null
        : body.variance_value;
    const measurement_time =
      body.measurement_time || null;
    const created_by =
      authUser.operator_id ||
      authUser.role ||
      "runtime_user";

    if (!tenant_id || !metric_name) {
      return send(res, 400, {
        error: "validation_error",
        message: "tenant_id and metric_name required"
      });
    }

    const measurementService =
      createRuntimeMeasurementWriteService({
        db,
        writeEvent
      });

    const measurement =
      await measurementService.create({
        tenant_id,
        outcome_id,
        metric_name,
        metric_value,
        metric_unit,
        target_value,
        variance_value,
        measurement_time,
        created_by
      });

    return send(res, 201, {
      measurement
    });
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
