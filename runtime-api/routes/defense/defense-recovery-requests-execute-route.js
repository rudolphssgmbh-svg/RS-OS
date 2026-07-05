const crypto = require("crypto");

async function handleDefenseRecoveryRequestsExecuteRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
if (req.method === "POST" && path.startsWith("/runtime/defense/recovery-requests/") && path.endsWith("/execute")) {
  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin"
  ]);

  if (!auth.allowed) {
    return send(res, auth.code, auth.response);
  }

  const recovery_request_id = path
    .replace("/runtime/defense/recovery-requests/", "")
    .replace("/execute", "");

  const body = await readBody(req);
  const tenant_id = auth.user.tenant_id;
  const actor_id = auth.user.username || auth.user.operator_id || "system";

  const requestResult = await db.query(`
    SELECT *
    FROM runtime_recovery_requests
    WHERE recovery_request_id = $1
      AND tenant_id = $2
    LIMIT 1
  `, [
    recovery_request_id,
    tenant_id
  ]);

  if (requestResult.rows.length === 0) {
    return send(res, 404, {
      error: "not_found",
      message: "recovery request not found"
    });
  }

  const recovery_request = requestResult.rows[0];

  if (recovery_request.review_status !== "approved") {
    return send(res, 409, {
      error: "recovery_not_approved",
      message: `review_status is ${recovery_request.review_status}`,
      recovery_request
    });
  }

  if (recovery_request.execution_status !== "pending") {
    return send(res, 409, {
      error: "recovery_not_pending",
      message: `execution_status is ${recovery_request.execution_status}`,
      recovery_request
    });
  }

  if (!recovery_request.savepoint_id) {
    return send(res, 400, {
      error: "missing_savepoint",
      message: "recovery request has no savepoint_id"
    });
  }

  await db.query(`
    UPDATE runtime_recovery_requests
    SET
      execution_status = 'executing',
      updated_at = now()
    WHERE recovery_request_id = $1
      AND tenant_id = $2
  `, [
    recovery_request_id,
    tenant_id
  ]);

  await writeEvent({
    event_type: "runtime.recovery.execution.started",
    object_id: recovery_request.savepoint_id,
    message: `Recovery execution started: ${recovery_request_id}`,
    tenant_id
  });

  const savepointResult = await db.query(`
    SELECT *
    FROM runtime_savepoints
    WHERE savepoint_id = $1
      AND tenant_id = $2
    LIMIT 1
  `, [
    recovery_request.savepoint_id,
    tenant_id
  ]);

  if (savepointResult.rows.length === 0) {
    await db.query(`
      UPDATE runtime_recovery_requests
      SET
        execution_status = 'failed',
        verification_status = 'savepoint_not_found',
        updated_at = now()
      WHERE recovery_request_id = $1
        AND tenant_id = $2
    `, [
      recovery_request_id,
      tenant_id
    ]);

    return send(res, 404, {
      error: "savepoint_not_found",
      message: "linked savepoint not found"
    });
  }

  const savepoint = savepointResult.rows[0];

  if (savepoint.rollback_status !== "available") {
    await db.query(`
      UPDATE runtime_recovery_requests
      SET
        execution_status = 'failed',
        verification_status = 'savepoint_not_available',
        updated_at = now()
      WHERE recovery_request_id = $1
        AND tenant_id = $2
    `, [
      recovery_request_id,
      tenant_id
    ]);

    return send(res, 409, {
      error: "savepoint_not_available",
      message: `savepoint rollback_status is ${savepoint.rollback_status}`,
      savepoint
    });
  }

  const previous_state = savepoint.previous_state || {};
  const restored_runtime_type =
    previous_state.runtime_type ||
    previous_state.type ||
    savepoint.object_type ||
    "restored_object";

  const restored_state =
    previous_state.state ||
    previous_state.status ||
    "restored";

  const restored_priority =
    previous_state.priority ||
    "normal";

  const restored_risk_score =
    Number(previous_state.risk_score || 0);

  const runtimeResult = await db.query(`
    INSERT INTO runtime_objects (
      object_id,
      runtime_type,
      state,
      priority,
      risk_score,
      tenant_id
    )
    VALUES (
      $1,$2,$3,$4,$5,$6
    )
    ON CONFLICT (object_id)
    DO UPDATE SET
      runtime_type = EXCLUDED.runtime_type,
      state = EXCLUDED.state,
      priority = EXCLUDED.priority,
      risk_score = EXCLUDED.risk_score,
      tenant_id = EXCLUDED.tenant_id
    RETURNING *
  `, [
    String(savepoint.object_id),
    restored_runtime_type,
    restored_state,
    restored_priority,
    restored_risk_score,
    tenant_id
  ]);

  const rollbackEventId = crypto.randomUUID();

  await db.query(`
    UPDATE runtime_savepoints
    SET
      rollback_status = 'used',
      rollback_event_id = $3,
      rolled_back_by = $4,
      rolled_back_at = now()
    WHERE savepoint_id = $1
      AND tenant_id = $2
  `, [
    savepoint.savepoint_id,
    tenant_id,
    rollbackEventId,
    actor_id
  ]);

  await db.query(`
    UPDATE runtime_recovery_requests
    SET
      execution_status = 'completed',
      rollback_event_id = $3,
      verification_status = 'restored',
      updated_at = now()
    WHERE recovery_request_id = $1
      AND tenant_id = $2
    RETURNING *
  `, [
    recovery_request_id,
    tenant_id,
    rollbackEventId
  ]);

  const finalResult = await db.query(`
    SELECT *
    FROM runtime_recovery_requests
    WHERE recovery_request_id = $1
      AND tenant_id = $2
    LIMIT 1
  `, [
    recovery_request_id,
    tenant_id
  ]);

  await db.query(`
    UPDATE runtime_defense_state
    SET
      defense_mode = 'recovery',
      defense_level = 'elevated',
      state_reason = $2,
      updated_by = $3,
      updated_at = now()
    WHERE tenant_id = $1
  `, [
    tenant_id,
    body.execution_reason || "approved recovery executed",
    actor_id
  ]);

  await writeEvent({
    event_type: "runtime.recovery.execution.completed",
    object_id: savepoint.object_id,
    message: `Recovery execution completed: ${recovery_request_id}`,
    tenant_id
  });

  return send(res, 200, {
    recovery_request: finalResult.rows[0],
    rollback: {
      rollback_event_id: rollbackEventId,
      savepoint_id: savepoint.savepoint_id,
      object_id: String(savepoint.object_id),
      status: "completed"
    },
    restored_object: runtimeResult.rows[0]
  });
}

  return false;
}

module.exports = {
  handleDefenseRecoveryRequestsExecuteRoute
};
