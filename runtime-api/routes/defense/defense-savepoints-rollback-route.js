const crypto = require("crypto");

async function handleDefenseSavepointsRollbackRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (req.method === "POST" && path.startsWith("/runtime/defense/savepoints/") && path.endsWith("/rollback")) {
    const auth = requireRole(req, [
      "system_admin",
      "runtime_admin"
    ]);

    if (!auth.allowed) {
      return send(res, auth.code, auth.response);
    }

    const savepoint_id = path
      .replace("/runtime/defense/savepoints/", "")
      .replace("/rollback", "");

    const body = await readBody(req);
    const tenant_id = auth.user.tenant_id;
    const actor_id = auth.user.username || auth.user.operator_id || "system";

    const savepointResult = await db.query(`
      SELECT *
      FROM runtime_savepoints
      WHERE savepoint_id = $1
        AND tenant_id = $2
      LIMIT 1
    `, [savepoint_id, tenant_id]);

    if (savepointResult.rows.length === 0) {
      return send(res, 404, {
        error: "not_found",
        message: "savepoint not found"
      });
    }

    const savepoint = savepointResult.rows[0];

    if (savepoint.rollback_status !== "available") {
      return send(res, 409, {
        error: "rollback_not_available",
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
      previous_state.priority || "normal";

    const restored_risk_score =
      Number(previous_state.risk_score || 0);

    await writeEvent({
      event_type: "runtime.defense.savepoint.rollback.started",
      object_id: String(savepoint.object_id),
      message: `Rollback started from savepoint: ${savepoint.savepoint_id}`,
      tenant_id
    });

    const runtimeResult = await db.query(`
      INSERT INTO runtime_objects (
        object_id,
        runtime_type,
        state,
        priority,
        risk_score,
        tenant_id
      )
      VALUES ($1,$2,$3,$4,$5,$6)
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
      savepoint_id,
      tenant_id,
      rollbackEventId,
      actor_id
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
      body.rollback_reason || "runtime rollback executed",
      actor_id
    ]);

    await writeEvent({
      event_type: "runtime.defense.savepoint.rollback.completed",
      object_id: String(savepoint.object_id),
      message: `Rollback completed from savepoint: ${savepoint.savepoint_id}`,
      tenant_id
    });

    return send(res, 200, {
      rollback: {
        rollback_event_id: rollbackEventId,
        savepoint_id,
        object_id: String(savepoint.object_id),
        status: "completed",
        reason: body.rollback_reason || "runtime rollback executed"
      },
      restored_object: runtimeResult.rows[0]
    });
  }

  return false;
}

module.exports = {
  handleDefenseSavepointsRollbackRoute
};
