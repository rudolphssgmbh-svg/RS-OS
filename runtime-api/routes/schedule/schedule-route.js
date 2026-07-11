const {
  buildEnforcementEvidence,
  enforceGovernanceDecisionGate
} = require("../../modules/governance/governance-enforcement-service");

async function handleScheduleRoute({
  req,
  res,
  path,
  db,
  send,
  requireRole,
  readBody,
  writeEvent
}) {
  if (!(req.method === "POST" && path === "/runtime/schedule")) {
    return false;
  }

  const auth = requireRole(req, [
    "system_admin",
    "runtime_admin"
  ]);

  if (!auth.allowed) {
    send(res, auth.code, auth.response);
    return true;
  }

  const tenant_id = auth.user.tenant_id;
  const body = await readBody(req);

  const object_id = body.object_id;
  const execution_type = body.execution_type || "diagnostic.run";
  const payload = body.payload || {};
  const priority = body.priority || 100;
  const delay_seconds = body.delay_seconds || 0;

  const scheduled_for = new Date(
    Date.now() + delay_seconds * 1000
  ).toISOString();

  if (!object_id) {
    send(res, 400, {
      error: "missing_object_id"
    });
    return true;
  }

  const governanceGate = await enforceGovernanceDecisionGate({
    db,
    tenant_id,
    object_id
  });

  const deniedEnforcementEvidence = buildEnforcementEvidence({
    route: "/runtime/schedule",
    action: execution_type,
    enforcementResult: governanceGate
  });

  if (!governanceGate.allowed) {
    await writeEvent({
      event_type:
        governanceGate.status === "blocked"
          ? "runtime.governance.gate.blocked"
          : "runtime.governance.gate.review_required",
      object_id,
      message: `Scheduling governance gate: ${governanceGate.reason}`,
      tenant_id,
      event_payload: deniedEnforcementEvidence
    });

    send(res, 403, governanceGate);
    return true;
  }

  const job_id = `job-${Date.now()}`;

  const scheduledEnforcementEvidence = buildEnforcementEvidence({
    route: "/runtime/schedule",
    action: execution_type,
    job_id,
    enforcementResult: governanceGate
  });

  await writeEvent({
    event_type: "runtime.governance.gate.allowed",
    object_id,
    message: `Scheduling governance gate: ${governanceGate.reason}`,
    tenant_id,
    event_payload: scheduledEnforcementEvidence
  });

  const result = await db.query(`
    INSERT INTO runtime_execution_jobs (
      job_id,
      tenant_id,
      object_id,
      execution_type,
      status,
      requested_by,
      payload,
      scheduled_for,
      available_at,
      priority
    )
    VALUES (
      $1, $2, $3, $4, 'pending', $5, $6, $7, $7, $8
    )
    RETURNING
      job_id,
      object_id,
      execution_type,
      status,
      scheduled_for,
      priority
  `, [
    job_id,
    tenant_id,
    object_id,
    execution_type,
    auth.user.username || "runtime_admin",
    JSON.stringify(payload),
    scheduled_for,
    priority
  ]);

  await writeEvent({
    event_type: "runtime.job.scheduled",
    object_id,
    message: `Runtime job scheduled for ${scheduled_for}`,
    tenant_id,
    event_payload: scheduledEnforcementEvidence
  });

  send(res, 200, {
    scheduled: true,
    job: result.rows[0]
  });
  return true;
}

module.exports = {
  handleScheduleRoute
};
